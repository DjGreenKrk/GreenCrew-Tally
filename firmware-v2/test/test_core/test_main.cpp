// Unit tests of the tally logic: pio test -e native
// The expected values come from the NodeMCU firmware (tally/src/*.lua) and
// from what the Hub sends (hub/src/tally/CommandCreator.ts).

#include <string.h>
#include <string>
#include <vector>

#include <unity.h>

#include "LedEngine.h"
#include "LightOutput.h"
#include "LogBuffer.h"
#include "Settings.h"
#include "SetupForm.h"
#include "SetupPage.h"
#include "StateMessage.h"
#include "HubFinder.h"
#include "TallyController.h"
#include "WifiSupervisor.h"

using namespace gctally;

namespace {

const Color red = {255, 0, 0};
const Color green = {0, 255, 0};
const Color blue = {0, 0, 255};
const Color black = {0, 0, 0};

void assertColor(const Color& expected, const Color& actual) {
    TEST_ASSERT_EQUAL_UINT8(expected.r, actual.r);
    TEST_ASSERT_EQUAL_UINT8(expected.g, actual.g);
    TEST_ASSERT_EQUAL_UINT8(expected.b, actual.b);
}

bool parse(const char* text, StateMessage& out) { return parseStateMessage(text, strlen(text), out); }

class FakePlatform : public Platform {
public:
    void sendToHub(const char* text) override { sent.push_back(text); }
    void printLine(const char* text) override { console.push_back(text); }
    std::vector<std::string> sent;
    std::vector<std::string> console;
};

Settings validSettings() {
    Settings settings("a1b2c3");
    settings.parse("station.ssid=Studio\nstation.password=secret\nhub.ip=192.168.1.10\ntally.name=CAM1\n");
    return settings;
}

class StringSink : public TextSink {
public:
    void write(const char* text) override { text_ += text; }
    bool contains(const char* part) const { return text_.find(part) != std::string::npos; }
    std::string text_;
};

std::string updated(const char* original, std::vector<IniChange> changes) {
    char out[512];
    TEST_ASSERT_TRUE(updateIni(original, changes.data(), changes.size(), out, sizeof(out)));
    return out;
}

SetupForm validForm() {
    SetupForm form;
    form.ssid = "Studio";
    form.password = "new-secret";
    form.name = "CAM2";
    form.hubIp = "192.168.1.20";
    form.hubPort = "7411";
    return form;
}

}  // namespace

void setUp() {}
void tearDown() {}

// --- state messages ---------------------------------------------------------

void test_parses_a_static_program_message() {
    StateMessage message;
    TEST_ASSERT_TRUE(parse("O255/000/000 S255/000/000", message));
    assertColor(red, message.operatorColor);
    assertColor(red, message.stageColor);
    TEST_ASSERT_FALSE(message.flashing);
}

void test_parses_the_unknown_flash_message() {
    StateMessage message;
    TEST_ASSERT_TRUE(parse("O000/000/255 S000/000/000 0x80 250", message));
    assertColor(blue, message.operatorColor);
    assertColor(black, message.stageColor);
    TEST_ASSERT_TRUE(message.flashing);
    TEST_ASSERT_EQUAL_HEX8(0x80, message.pattern);
    TEST_ASSERT_EQUAL_UINT16(250, message.stepMs);
}

void test_parses_the_highlight_message_and_lowercase_hex() {
    StateMessage message;
    TEST_ASSERT_TRUE(parse("O255/255/255 S255/255/255 0xAA 125", message));
    TEST_ASSERT_EQUAL_HEX8(0xAA, message.pattern);
    TEST_ASSERT_TRUE(parse("O255/255/255 S255/255/255 0xaa 125", message));
    TEST_ASSERT_EQUAL_HEX8(0xAA, message.pattern);
}

void test_ignores_surrounding_whitespace() {
    StateMessage message;
    TEST_ASSERT_TRUE(parse("  O000/255/000 S000/000/000\n", message));
    assertColor(green, message.operatorColor);
}

void test_rejects_malformed_messages() {
    StateMessage message;
    const char* invalid[] = {
        "",
        "tally-ho \"CAM1\"",
        "O255/000/000 S255/000/00",         // too short
        "X255/000/000 S255/000/000",        // no O
        "O255-000/000 S255/000/000",        // wrong separator
        "O255/000/000S 255/000/000",        // no space before S
        "O2a5/000/000 S255/000/000",        // not a number
        "O256/000/000 S255/000/000",        // above 255
        "O255/000/000 S255/000/000 0x8 2500",
        "O255/000/000 S255/000/000 0xZZ 250",
        "O255/000/000 S255/000/000 1x80 250",
        "O255/000/000 S255/000/000 0x80 2a0",
    };
    for (const char* text : invalid) {
        TEST_ASSERT_FALSE_MESSAGE(parse(text, message), text);
    }
}

// --- LED engine -------------------------------------------------------------

void test_dim_rounds_up_like_lua() {
    // math.ceil(v * 0.3): 76.5 -> 77, 0.3 -> 1
    assertColor({77, 0, 3}, LedEngine::dim({255, 0, 10}));
    assertColor({1, 1, 0}, LedEngine::dim({1, 2, 0}));
}

void test_static_colour_is_shown_at_once() {
    LedEngine leds;
    leds.showStatic(red, green);
    TEST_ASSERT_TRUE(leds.tick(0));
    assertColor(red, leds.frame().operatorColor);
    assertColor(green, leds.frame().stageColor);
    TEST_ASSERT_FALSE(leds.tick(5000));
}

void test_flash_pattern_steps_through_bits_msb_first() {
    LedEngine leds;
    StateMessage message;
    parse("O000/000/255 S000/000/000 0x80 250", message);  // unknown: 1 bright, 7 dim
    leds.show(message, 1000);
    leds.tick(1000);
    assertColor(blue, leds.frame().operatorColor);
    leds.tick(1249);
    assertColor(blue, leds.frame().operatorColor);
    TEST_ASSERT_TRUE(leds.tick(1250));
    assertColor({0, 0, 77}, leds.frame().operatorColor);
    leds.tick(1000 + 7 * 250);
    assertColor({0, 0, 77}, leds.frame().operatorColor);
    TEST_ASSERT_TRUE(leds.tick(1000 + 8 * 250));
    assertColor(blue, leds.frame().operatorColor);
}

void test_repeating_the_running_pattern_keeps_its_rhythm() {
    LedEngine leds;
    StateMessage message;
    parse("O255/255/255 S255/255/255 0xAA 125", message);
    leds.show(message, 0);
    leds.tick(125);  // second step: dim
    leds.show(message, 130);  // the Hub's keep-alive
    leds.tick(130);
    assertColor({77, 77, 77}, leds.frame().operatorColor);
    leds.tick(250);
    assertColor({255, 255, 255}, leds.frame().operatorColor);
}

void test_a_different_pattern_restarts() {
    LedEngine leds;
    leds.showWaitForHub(0);
    leds.tick(150);  // dim step
    leds.showWaitForWifi(160);
    leds.tick(160);
    assertColor(blue, leds.frame().operatorColor);
}

void test_static_after_flash_stops_the_pattern() {
    LedEngine leds;
    leds.showWaitForWifi(0);
    leds.showStatic(red, red);
    leds.tick(0);
    leds.tick(500);
    leds.tick(1000);
    assertColor(red, leds.frame().operatorColor);
}

void test_status_patterns_match_v1() {
    // waitForWifiConnection {bright, dim} 500 ms
    LedEngine leds;
    leds.showWaitForWifi(0);
    leds.tick(0);
    assertColor(blue, leds.frame().operatorColor);
    leds.tick(500);
    assertColor({0, 0, 77}, leds.frame().operatorColor);
    leds.tick(1000);
    assertColor(blue, leds.frame().operatorColor);

    // invalidSettingsFile: 3 blinks then 6 dim steps, 150 ms
    leds.showInvalidSettings(0);
    const bool expected[] = {true, false, true, false, true, false, false, false, false, false, false, false, true};
    for (uint32_t i = 0; i < 13; i++) {
        leds.tick(i * 150);
        TEST_ASSERT_EQUAL_UINT8_MESSAGE(expected[i] ? 255 : 77, leds.frame().operatorColor.b, std::to_string(i).c_str());
    }
}

void test_late_ticks_skip_steps() {
    LedEngine leds;
    leds.showWaitForIp(0);  // 1010, 250 ms
    leds.tick(0);
    leds.tick(760);  // three steps passed: index 3 (dim)
    assertColor({0, 0, 77}, leds.frame().operatorColor);
    leds.tick(1000);
    assertColor(blue, leds.frame().operatorColor);
}

void test_pattern_survives_millis_overflow() {
    LedEngine leds;
    leds.showWaitForWifi(0xFFFFFF00u);
    leds.tick(0xFFFFFF00u);
    leds.tick(0xFFFFFF00u + 500);  // wraps past zero
    assertColor({0, 0, 77}, leds.frame().operatorColor);
}

// --- light output -----------------------------------------------------------

void test_common_anode_inverts_pwm() {
    Settings settings("x");
    Frame frame{red, green};
    LightOutput output = LightOutput::from(frame, settings);
    TEST_ASSERT_EQUAL_UINT8(0, output.pwm[LightOutput::operatorRed]);
    TEST_ASSERT_EQUAL_UINT8(255, output.pwm[LightOutput::operatorGreen]);
    TEST_ASSERT_EQUAL_UINT8(0, output.pwm[LightOutput::stageGreen]);
}

void test_common_cathode_keeps_pwm() {
    Settings settings("x");
    settings.parse("operator.type=GRB-\nstage.type=grb-\n");
    LightOutput output = LightOutput::from(Frame{red, {0, 0, 77}}, settings);
    TEST_ASSERT_EQUAL_UINT8(255, output.pwm[LightOutput::operatorRed]);
    TEST_ASSERT_EQUAL_UINT8(0, output.pwm[LightOutput::operatorGreen]);
    TEST_ASSERT_EQUAL_UINT8(77, output.pwm[LightOutput::stageBlue]);
}

void test_ws2812_bytes_follow_the_configured_order() {
    Settings settings("x");
    settings.parse("operator.ws2812=2 grb\nstage.ws2812=1 rgb\n");
    LightOutput output = LightOutput::from(Frame{{10, 20, 30}, {40, 50, 60}}, settings);
    TEST_ASSERT_EQUAL_UINT8(3, output.ws2812Lights);
    const uint8_t expected[] = {20, 10, 30, 20, 10, 30, 40, 50, 60};
    TEST_ASSERT_EQUAL_UINT8_ARRAY(expected, output.ws2812, 9);
}

void test_d1_mini_4x4_matrix() {
    Settings settings("x");
    settings.parse("operator.ws2812=16 grb\nstage.ws2812=0 grb\n");
    LightOutput output = LightOutput::from(Frame{red, red}, settings);
    TEST_ASSERT_EQUAL_UINT8(16, output.ws2812Lights);
    for (int i = 0; i < 16; i++) {
        TEST_ASSERT_EQUAL_UINT8(0, output.ws2812[3 * i]);
        TEST_ASSERT_EQUAL_UINT8(255, output.ws2812[3 * i + 1]);
        TEST_ASSERT_EQUAL_UINT8(0, output.ws2812[3 * i + 2]);
    }
}

void test_onboard_led_follows_v1_rule() {
    Settings settings("x");
    TEST_ASSERT_TRUE(LightOutput::from(Frame{blue, black}, settings).onboardLedOn);
    TEST_ASSERT_FALSE(LightOutput::from(Frame{{0, 0, 77}, black}, settings).onboardLedOn);
    TEST_ASSERT_FALSE(LightOutput::from(Frame{black, black}, settings).onboardLedOn);
    TEST_ASSERT_FALSE(LightOutput::from(Frame{{77, 77, 77}, black}, settings).onboardLedOn);
    TEST_ASSERT_TRUE(LightOutput::from(Frame{{255, 255, 255}, black}, settings).onboardLedOn);
    TEST_ASSERT_TRUE(LightOutput::from(Frame{red, black}, settings).onboardLedOn);
}

// --- settings ---------------------------------------------------------------

void test_settings_defaults() {
    Settings settings("a1b2c3");
    TEST_ASSERT_FALSE(settings.isValid());
    TEST_ASSERT_EQUAL_STRING("a1b2c3", settings.tallyName());
    TEST_ASSERT_EQUAL_UINT16(7411, settings.hubUdpPort());
    TEST_ASSERT_EQUAL_UINT8(5, settings.operatorWs2812Lights);
    TEST_ASSERT_EQUAL_UINT8(0, settings.stageWs2812Lights);
    TEST_ASSERT_TRUE(settings.operatorType == LightType::commonAnode);
}

void test_settings_reads_the_example_file() {
    Settings settings("a1b2c3");
    settings.parse(
        "; GC Tally\r\n"
        "station.ssid = YOUR_WIFI_SSID \r\n"
        "station.password=YOUR_WIFI_PASSWORD\r\n"
        "hub.ip=192.168.1.100\r\n"
        "hub.port=7412\r\n"
        "tally.name=CAM1\r\n"
        "operator.ws2812=16 grb\r\n"
        "stage.ws2812=0 grb\r\n");
    TEST_ASSERT_TRUE(settings.isValid());
    TEST_ASSERT_EQUAL_STRING("YOUR_WIFI_SSID", settings.stationSsid());
    TEST_ASSERT_EQUAL_STRING("YOUR_WIFI_PASSWORD", settings.stationPassword());
    TEST_ASSERT_EQUAL_STRING("192.168.1.100", settings.hubAddress());
    TEST_ASSERT_EQUAL_UINT16(7412, settings.hubUdpPort());
    TEST_ASSERT_EQUAL_STRING("CAM1", settings.tallyName());
    TEST_ASSERT_EQUAL_UINT8(16, settings.operatorWs2812Lights);
    TEST_ASSERT_EQUAL_size_t(0, settings.warningCount());
}

void test_settings_password_may_contain_equals() {
    Settings settings("x");
    settings.parseLine("station.password=a=b==c");
    TEST_ASSERT_EQUAL_STRING("a=b==c", settings.stationPassword());
}

void test_settings_name_is_cut_to_26_characters() {
    Settings settings("x");
    settings.parseLine("tally.name=abcdefghijklmnopqrstuvwxyz0123");
    TEST_ASSERT_EQUAL_STRING("abcdefghijklmnopqrstuvwxyz", settings.tallyName());
}

void test_settings_warns_and_keeps_defaults() {
    Settings settings("x");
    settings.parse("operator.ws2812=33\nstage.ws2812=4 bgr\noperator.type=common\nhub.port=abc\nhub.ipp=1.2.3.4\n");
    TEST_ASSERT_EQUAL_UINT8(5, settings.operatorWs2812Lights);
    TEST_ASSERT_EQUAL_UINT8(4, settings.stageWs2812Lights);
    TEST_ASSERT_TRUE(settings.stageWs2812Order == Ws2812Order::grb);
    TEST_ASSERT_EQUAL_UINT16(7411, settings.hubUdpPort());
    TEST_ASSERT_EQUAL_size_t(5, settings.warningCount());
    TEST_ASSERT_EQUAL_STRING("Unknown key hub.ipp in configuration file. Did you mistype it?", settings.warning(4));
}

void test_settings_ignores_comments_and_empty_values() {
    Settings settings("x");
    settings.parse(";station.ssid=Hidden\nstation.ssid=\nhub.ip\n");
    TEST_ASSERT_EQUAL_STRING("", settings.stationSsid());
    TEST_ASSERT_EQUAL_STRING("", settings.hubAddress());
    TEST_ASSERT_EQUAL_size_t(0, settings.warningCount());
}

void test_host_name() {
    Settings settings("x");
    settings.parseLine("tally.name= -Kamera 1 (lewa)- ");
    char hostName[40];
    settings.hostName(hostName, sizeof(hostName));
    TEST_ASSERT_EQUAL_STRING("Tally-Kamera-1-lewa", hostName);
}

// --- log buffer -------------------------------------------------------------

void test_log_buffer_keeps_order() {
    LogBuffer buffer;
    buffer.add(Severity::info, "one");
    buffer.add(Severity::error, "two");
    Severity severity;
    char message[81];
    TEST_ASSERT_TRUE(buffer.take(severity, message, sizeof(message)));
    TEST_ASSERT_EQUAL_STRING("one", message);
    TEST_ASSERT_TRUE(buffer.take(severity, message, sizeof(message)));
    TEST_ASSERT_TRUE(severity == Severity::error);
    TEST_ASSERT_FALSE(buffer.take(severity, message, sizeof(message)));
}

void test_log_buffer_pushes_out_the_oldest_lowest_severity() {
    LogBuffer buffer;
    buffer.add(Severity::warning, "w1");
    buffer.add(Severity::info, "i1");
    for (int i = 0; i < 8; i++) buffer.add(Severity::error, "e");
    buffer.add(Severity::warning, "w2");  // removes i1
    TEST_ASSERT_EQUAL_size_t(10, buffer.size());
    buffer.add(Severity::info, "i2");  // full, nothing of info level left: dropped
    buffer.add(Severity::warning, "w3");  // removes w1
    Severity severity;
    char message[81];
    buffer.take(severity, message, sizeof(message));
    TEST_ASSERT_EQUAL_STRING("e", message);
    for (int i = 0; i < 7; i++) buffer.take(severity, message, sizeof(message));
    buffer.take(severity, message, sizeof(message));
    TEST_ASSERT_EQUAL_STRING("w2", message);
    buffer.take(severity, message, sizeof(message));
    TEST_ASSERT_EQUAL_STRING("w3", message);
}

void test_log_buffer_cuts_long_messages() {
    LogBuffer buffer;
    std::string longText(120, 'x');
    buffer.add(Severity::info, longText.c_str());
    Severity severity;
    char message[200];
    buffer.take(severity, message, sizeof(message));
    TEST_ASSERT_EQUAL_size_t(80, strlen(message));
}

// --- controller -------------------------------------------------------------

void test_invalid_settings_blink() {
    Settings settings("x");
    LedEngine leds;
    FakePlatform platform;
    TallyController controller(settings, "00a1b2c3", leds, platform);
    controller.begin(0);
    leds.tick(0);
    leds.tick(150);
    assertColor({0, 0, 77}, leds.frame().operatorColor);
}

void test_hello_is_compatible_with_the_v1_parser() {
    Settings settings = validSettings();
    LedEngine leds;
    FakePlatform platform;
    TallyController controller(settings, "a1b2c3", leds, platform);
    char hello[128];
    controller.helloMessage(hello, sizeof(hello));
    TEST_ASSERT_EQUAL_STRING("tally-ho \"CAM1\" gc/1 id=a1b2c3 fw=" GC_FIRMWARE_VERSION " hw=esp8266 caps=ws2812,pwm", hello);
    // the Hub's regex /^([^ ]+) "(.+)"/ needs exactly one pair of quotes after the name
    TEST_ASSERT_NULL(strchr(strchr(strchr(hello, '"') + 1, '"') + 1, '"'));
}

void test_controller_connects_and_follows_the_hub() {
    Settings settings = validSettings();
    LedEngine leds;
    FakePlatform platform;
    TallyController controller(settings, "a1b2c3", leds, platform);
    controller.begin(0);
    controller.wifiConnecting(0);
    TEST_ASSERT_EQUAL_size_t(0, platform.sent.size());

    controller.wifiAssociated(100);
    controller.wifiGotIp(200);
    TEST_ASSERT_TRUE(controller.isWifiUp());
    TEST_ASSERT_FALSE(controller.isHubConnected(200));
    // "Contacting hub" log, then the first hello
    TEST_ASSERT_EQUAL_size_t(2, platform.sent.size());
    TEST_ASSERT_EQUAL_STRING("log \"CAM1\" INFO \"Contacting hub on 192.168.1.10:7411\"\n", platform.sent[0].c_str());
    TEST_ASSERT_EQUAL_size_t(0, platform.sent[1].find("tally-ho \"CAM1\" gc/1"));

    const char* program = "O255/000/000 S255/000/000";
    controller.packetReceived(program, strlen(program), 300);
    leds.tick(300);
    assertColor(red, leds.frame().operatorColor);
    TEST_ASSERT_TRUE(controller.isHubConnected(3300));

    // hello every second while the Wi-Fi is up
    controller.tick(1000);
    TEST_ASSERT_EQUAL_size_t(3, platform.sent.size());
    controller.tick(1500);
    TEST_ASSERT_EQUAL_size_t(3, platform.sent.size());
    controller.tick(2000);
    TEST_ASSERT_EQUAL_size_t(4, platform.sent.size());
    assertColor(red, leds.frame().operatorColor);
}

void test_controller_shows_lost_hub_after_three_seconds() {
    Settings settings = validSettings();
    LedEngine leds;
    FakePlatform platform;
    TallyController controller(settings, "a1b2c3", leds, platform);
    controller.begin(0);
    controller.wifiGotIp(0);
    const char* program = "O255/000/000 S255/000/000";
    controller.packetReceived(program, strlen(program), 0);
    for (uint32_t t = 0; t <= 3000; t += 50) controller.tick(t);
    leds.tick(3000);
    assertColor(red, leds.frame().operatorColor);
    for (uint32_t t = 3050; t <= 4000; t += 50) controller.tick(t);
    leds.tick(4000);
    assertColor(blue, leds.frame().operatorColor);
    leds.tick(4150);
    assertColor({0, 0, 77}, leds.frame().operatorColor);

    // the Hub comes back
    controller.packetReceived(program, strlen(program), 4200);
    leds.tick(4200);
    assertColor(red, leds.frame().operatorColor);
}

void test_controller_buffers_logs_until_the_hub_answers() {
    Settings settings = validSettings();
    LedEngine leds;
    FakePlatform platform;
    TallyController controller(settings, "a1b2c3", leds, platform);
    controller.begin(0);
    controller.log(Severity::error, "booted because of Exception");
    TEST_ASSERT_EQUAL_size_t(0, platform.sent.size());
    TEST_ASSERT_EQUAL_STRING("[ERROR] booted because of Exception", platform.console[0].c_str());

    controller.wifiGotIp(0);
    // the "Contacting hub" log waits behind the buffered one
    TEST_ASSERT_EQUAL_size_t(1, platform.sent.size());
    controller.tick(50);
    TEST_ASSERT_EQUAL_size_t(1, platform.sent.size());  // no packet from the Hub yet

    const char* program = "O255/000/000 S255/000/000";
    controller.packetReceived(program, strlen(program), 60);
    controller.tick(100);
    TEST_ASSERT_EQUAL_STRING("log \"CAM1\" ERROR \"booted because of Exception\"\n", platform.sent[1].c_str());
    controller.tick(150);
    TEST_ASSERT_EQUAL_STRING("log \"CAM1\" INFO \"Contacting hub on 192.168.1.10:7411\"\n", platform.sent[2].c_str());
}

void test_controller_logs_invalid_packets() {
    Settings settings = validSettings();
    LedEngine leds;
    FakePlatform platform;
    TallyController controller(settings, "a1b2c3", leds, platform);
    controller.begin(0);
    controller.wifiGotIp(0);
    const char* junk = "hello";
    controller.packetReceived(junk, strlen(junk), 10);
    TEST_ASSERT_EQUAL_STRING("[WARN]  invalid package: hello", platform.console.back().c_str());
}

void test_controller_wifi_loss_blinks_and_stops_hello() {
    Settings settings = validSettings();
    LedEngine leds;
    FakePlatform platform;
    TallyController controller(settings, "a1b2c3", leds, platform);
    controller.begin(0);
    controller.wifiGotIp(0);
    size_t sent = platform.sent.size();
    controller.wifiLost(500);
    leds.tick(500);
    leds.tick(1000);
    assertColor({0, 0, 77}, leds.frame().operatorColor);  // 500 ms blink
    controller.tick(1000);
    controller.tick(2000);
    TEST_ASSERT_EQUAL_size_t(sent, platform.sent.size());
}

// --- setup settings ---------------------------------------------------------

void test_settings_setup_keys() {
    Settings settings("x");
    TEST_ASSERT_EQUAL_STRING("", settings.setupPassword());
    TEST_ASSERT_EQUAL_UINT32(30000, settings.recoveryAfterMs());
    settings.parse("setup.password=lamp-key-1\nsetup.recovery-after=0\n");
    TEST_ASSERT_EQUAL_STRING("lamp-key-1", settings.setupPassword());
    TEST_ASSERT_EQUAL_UINT32(0, settings.recoveryAfterMs());
    TEST_ASSERT_EQUAL_size_t(0, settings.warningCount());
}

void test_settings_rejects_a_short_setup_password() {
    Settings settings("x");
    settings.parse("setup.password=short\nsetup.recovery-after=soon\n");
    TEST_ASSERT_EQUAL_STRING("", settings.setupPassword());
    TEST_ASSERT_EQUAL_UINT32(30000, settings.recoveryAfterMs());
    TEST_ASSERT_EQUAL_size_t(2, settings.warningCount());
}

void test_setup_password_is_printable_ascii() {
    TEST_ASSERT_TRUE(isSetupPassword("crew pass 1!"));
    TEST_ASSERT_TRUE(isSetupPassword("123456789012345678901234567890123456789012345678901234567890123"));
    TEST_ASSERT_FALSE(isSetupPassword("1234567"));
    TEST_ASSERT_FALSE(isSetupPassword("1234567890123456789012345678901234567890123456789012345678901234"));
    TEST_ASSERT_FALSE(isSetupPassword("ha\tsło-ekipy"));
    TEST_ASSERT_FALSE(isSetupPassword("hasło-ekipy"));
}

void test_setup_password_from_settings_then_crew_then_generated() {
    TEST_ASSERT_TRUE(pickSetupPassword("lamp-key-1", "crew-key-1") == SetupPasswordSource::settings);
    TEST_ASSERT_TRUE(pickSetupPassword("", "crew-key-1") == SetupPasswordSource::crew);
    TEST_ASSERT_TRUE(pickSetupPassword("", "") == SetupPasswordSource::generated);
    TEST_ASSERT_TRUE(pickSetupPassword("", "short") == SetupPasswordSource::generated);
}

void test_setup_led_pattern_is_purple() {
    LedEngine leds;
    leds.showSetup(0);
    leds.tick(0);
    assertColor({255, 0, 255}, leds.frame().operatorColor);
    leds.tick(1000);
    assertColor({77, 0, 77}, leds.frame().operatorColor);
    leds.tick(2000);
    assertColor({255, 0, 255}, leds.frame().operatorColor);
}

// --- setup form ---------------------------------------------------------------

void test_form_accepts_valid_input() {
    TEST_ASSERT_TRUE(validateSetupForm(validForm()) == FormError::none);
    SetupForm form = validForm();
    form.password = "";  // keep the stored one
    form.hubPort = "";   // default port
    form.hubIp = "hub.local";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::none);
    form.hubIp = "";  // look for the Hub
    form.hubId = "1a2b3c4d";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::none);
    form.password = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";  // 64 hex digits
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::none);
}

void test_form_rejects_invalid_input() {
    SetupForm form = validForm();
    form.ssid = "";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::ssidMissing);
    form.ssid = "123456789012345678901234567890123";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::ssidInvalid);
    form.ssid = "Studio ";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::ssidInvalid);
    form.ssid = "Stu\ndio";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::ssidInvalid);

    form = validForm();
    form.password = "short";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::passwordLength);
    form.password = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdeg";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::passwordLength);
    form.password = " secret-with-space";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::passwordInvalid);

    form = validForm();
    form.name = "";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::nameMissing);
    form.name = "CAM \"1\"";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::nameInvalid);
    form.name = "123456789012345678901234567";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::nameInvalid);

    form = validForm();
    form.hubIp = "192.168.1.20\nstation.ssid=x";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::hubIpInvalid);

    form = validForm();
    form.hubPort = "0";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::hubPortInvalid);
    form.hubPort = "74x";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::hubPortInvalid);

    form = validForm();
    form.hubId = "1A2B3C4D";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::hubIdInvalid);
    form.hubId = "1a2b3c4";
    TEST_ASSERT_TRUE(validateSetupForm(form) == FormError::hubIdInvalid);
}

void test_ini_update_replaces_in_place_and_keeps_comments() {
    TEST_ASSERT_EQUAL_STRING("; my tally\nstation.ssid=New\n; LEDs\noperator.ws2812=16 grb\n",
                             updated("; my tally\nstation.ssid = Old\nstation.ssid=Older\r\n; LEDs\noperator.ws2812=16 grb\n", {{"station.ssid", "New"}}).c_str());
}

void test_ini_update_adds_and_removes_keys() {
    TEST_ASSERT_EQUAL_STRING("tally.name=CAM1\nhub.ip=10.0.0.2\n", updated("station.password=old\ntally.name=CAM1", {{"station.password", nullptr}, {"hub.ip", "10.0.0.2"}}).c_str());
    TEST_ASSERT_EQUAL_STRING("station.ssid=Studio\n", updated("", {{"station.ssid", "Studio"}}).c_str());
    TEST_ASSERT_EQUAL_STRING(";station.ssid=Commented\nstation.ssid=Studio\n", updated(";station.ssid=Commented\n", {{"station.ssid", "Studio"}}).c_str());
}

void test_ini_update_fails_when_the_result_does_not_fit() {
    IniChange change = {"station.ssid", "Studio"};
    char out[10];
    TEST_ASSERT_FALSE(updateIni("tally.name=CAM1\n", &change, 1, out, sizeof(out)));
}

void test_saved_form_reads_back_as_the_new_settings() {
    const char* original = "station.ssid=Old\nstation.password=old-secret\nhub.ip=192.168.1.10\ntally.name=CAM1\noperator.ws2812=16 grb\nsetup.password=lamp-key-1\n";
    char out[512];

    TEST_ASSERT_TRUE(applySetupForm(original, validForm(), out, sizeof(out)));
    Settings settings("x");
    settings.parse(out);
    TEST_ASSERT_EQUAL_STRING("Studio", settings.stationSsid());
    TEST_ASSERT_EQUAL_STRING("new-secret", settings.stationPassword());
    TEST_ASSERT_EQUAL_STRING("CAM2", settings.tallyName());
    TEST_ASSERT_EQUAL_STRING("192.168.1.20", settings.hubAddress());
    TEST_ASSERT_EQUAL_UINT8(16, settings.operatorWs2812Lights);
    TEST_ASSERT_EQUAL_STRING("lamp-key-1", settings.setupPassword());
    TEST_ASSERT_EQUAL_size_t(0, settings.warningCount());

    SetupForm keep = validForm();
    keep.password = "";
    TEST_ASSERT_TRUE(applySetupForm(original, keep, out, sizeof(out)));
    Settings kept("x");
    kept.parse(out);
    TEST_ASSERT_EQUAL_STRING("old-secret", kept.stationPassword());

    SetupForm discover = validForm();
    discover.hubIp = "";
    discover.hubId = "1a2b3c4d";
    TEST_ASSERT_TRUE(applySetupForm(original, discover, out, sizeof(out)));
    Settings discovering("x");
    discovering.parse(out);
    TEST_ASSERT_TRUE(discovering.isValid());
    TEST_ASSERT_FALSE(discovering.hasHubAddress());
    TEST_ASSERT_EQUAL_STRING("1a2b3c4d", discovering.pinnedHubId());
    TEST_ASSERT_EQUAL_size_t(0, discovering.warningCount());

    SetupForm open = keep;
    open.openNetwork = true;
    TEST_ASSERT_TRUE(applySetupForm(original, open, out, sizeof(out)));
    Settings opened("x");
    opened.parse(out);
    TEST_ASSERT_EQUAL_STRING("", opened.stationPassword());
}

// --- Wi-Fi supervisor -----------------------------------------------------------

void test_supervisor_connects_at_once_and_backs_off() {
    WifiSupervisor wifi(30000, false);
    wifi.begin(0);
    TEST_ASSERT_TRUE(wifi.connectDue(0));
    TEST_ASSERT_FALSE(wifi.connectDue(1));
    wifi.connectStarted(0);

    const uint32_t expected[] = {2000, 4000, 8000, 16000, 30000, 30000};
    uint32_t now = 0;
    for (uint32_t delay : expected) {
        now += 100;
        wifi.lost(now, 201);
        TEST_ASSERT_EQUAL_UINT32(delay, wifi.retryDelayMs());
        TEST_ASSERT_FALSE(wifi.connectDue(now + delay - 1));
        now += delay;
        TEST_ASSERT_TRUE(wifi.connectDue(now));
        wifi.connectStarted(now);
    }
    TEST_ASSERT_TRUE(wifi.lastFailure() == WifiFailure::networkNotFound);

    wifi.gotIp(now);
    TEST_ASSERT_TRUE(wifi.lastFailure() == WifiFailure::none);
    wifi.lost(now + 1, 201);
    TEST_ASSERT_EQUAL_UINT32(2000, wifi.retryDelayMs());
}

void test_supervisor_retries_quickly_after_auth_expire_and_dhcp_timeout() {
    WifiSupervisor wifi(30000, false);
    wifi.begin(0);
    wifi.lost(10, 2);
    TEST_ASSERT_EQUAL_UINT32(200, wifi.retryDelayMs());
    wifi.dhcpTimeout(300);
    TEST_ASSERT_EQUAL_UINT32(200, wifi.retryDelayMs());
    TEST_ASSERT_TRUE(wifi.lastFailure() == WifiFailure::noIp);
    wifi.lost(600, 2);  // third failure in a row: back off
    TEST_ASSERT_EQUAL_UINT32(8000, wifi.retryDelayMs());
}

void test_supervisor_counts_a_silent_attempt_as_failed() {
    WifiSupervisor wifi(30000, false);
    wifi.begin(0);
    TEST_ASSERT_TRUE(wifi.connectDue(0));
    wifi.connectStarted(0);
    TEST_ASSERT_FALSE(wifi.connectDue(19999));
    TEST_ASSERT_FALSE(wifi.connectDue(20000));  // failed now, retry in 2 s
    TEST_ASSERT_TRUE(wifi.connectDue(22000));
}

void test_supervisor_offers_recovery_ap_after_the_outage() {
    WifiSupervisor wifi(30000, false);
    wifi.begin(0);
    wifi.gotIp(5000);
    TEST_ASSERT_FALSE(wifi.recoveryApWanted(100000));
    wifi.lost(100000, 201);
    TEST_ASSERT_FALSE(wifi.recoveryApWanted(129999));
    TEST_ASSERT_TRUE(wifi.recoveryApWanted(130000));

    wifi.setApClients(1);
    wifi.gotIp(140000);
    TEST_ASSERT_TRUE(wifi.recoveryApWanted(140000));  // someone is still on the setup page
    wifi.setApClients(0);
    TEST_ASSERT_FALSE(wifi.recoveryApWanted(140001));
}

void test_supervisor_without_wifi_from_the_start_offers_recovery_ap() {
    WifiSupervisor wifi(30000, false);
    wifi.begin(1000);
    TEST_ASSERT_FALSE(wifi.recoveryApWanted(30999));
    TEST_ASSERT_TRUE(wifi.recoveryApWanted(31000));
}

void test_supervisor_recovery_ap_can_be_turned_off() {
    WifiSupervisor wifi(0, false);
    wifi.begin(0);
    TEST_ASSERT_FALSE(wifi.recoveryApWanted(3600000));
}

void test_supervisor_reconnects_rarely_while_the_recovery_ap_is_used() {
    WifiSupervisor wifi(30000, false);
    wifi.begin(0);
    wifi.connectDue(0);
    wifi.connectStarted(0);
    wifi.lost(100, 201);
    wifi.setApClients(1);
    TEST_ASSERT_FALSE(wifi.connectDue(2100));
    TEST_ASSERT_TRUE(wifi.connectDue(30100));
}

void test_supervisor_trial_succeeds_with_an_ip() {
    WifiSupervisor wifi(30000, true);
    wifi.begin(0);
    TEST_ASSERT_TRUE(wifi.trial(0) == WifiSupervisor::Trial::running);
    TEST_ASSERT_FALSE(wifi.recoveryApWanted(35000));
    wifi.gotIp(35000);
    TEST_ASSERT_TRUE(wifi.trial(35000) == WifiSupervisor::Trial::succeeded);
    wifi.lost(50000, 201);
    TEST_ASSERT_TRUE(wifi.recoveryApWanted(80000));  // a normal tally from now on
}

void test_supervisor_trial_fails_after_the_timeout() {
    WifiSupervisor wifi(30000, true);
    wifi.begin(0);
    wifi.lost(1000, 202);
    TEST_ASSERT_TRUE(wifi.trial(39999) == WifiSupervisor::Trial::running);
    TEST_ASSERT_TRUE(wifi.trial(40000) == WifiSupervisor::Trial::failed);
    TEST_ASSERT_TRUE(wifi.lastFailure() == WifiFailure::wrongPassword);
}

void test_classifies_disconnect_reasons() {
    TEST_ASSERT_TRUE(classifyDisconnect(201) == WifiFailure::networkNotFound);
    TEST_ASSERT_TRUE(classifyDisconnect(202) == WifiFailure::wrongPassword);
    TEST_ASSERT_TRUE(classifyDisconnect(15) == WifiFailure::wrongPassword);
    TEST_ASSERT_TRUE(classifyDisconnect(204) == WifiFailure::wrongPassword);
    TEST_ASSERT_TRUE(classifyDisconnect(8) == WifiFailure::other);
}

// --- setup page -----------------------------------------------------------------

void test_picks_the_page_language() {
    TEST_ASSERT_TRUE(pickLanguage("pl-PL,pl;q=0.9,en;q=0.8") == Language::pl);
    TEST_ASSERT_TRUE(pickLanguage("PL") == Language::pl);
    TEST_ASSERT_TRUE(pickLanguage("en-US,pl;q=0.5") == Language::en);
    TEST_ASSERT_TRUE(pickLanguage("plx") == Language::en);
    TEST_ASSERT_TRUE(pickLanguage("") == Language::en);
}

void test_escapes_html() {
    StringSink sink;
    writeEscaped(sink, "<a href=\"x\">Tom & Jerry's</a>");
    TEST_ASSERT_EQUAL_STRING("&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;", sink.text_.c_str());
    StringSink longText;
    std::string input(200, '&');
    writeEscaped(longText, input.c_str());
    TEST_ASSERT_EQUAL_size_t(1000, longText.text_.size());
}

void test_setup_page_shows_settings_but_never_the_password() {
    ScannedNetwork networks[] = {{"Studio <5G>", -60, true}, {"Guests", -80, false}};
    SetupPageModel model;
    model.language = Language::pl;
    model.deviceId = "a1b2c3";
    model.firmware = "2.0.0-dev";
    model.ssid = "Studio";
    model.hasPassword = true;
    model.name = "CAM1";
    model.hubIp = "192.168.1.10";
    model.networks = networks;
    model.networkCount = 2;
    model.trialFailure = WifiFailure::wrongPassword;
    model.trialSsid = "Nowa";
    model.error = FormError::nameInvalid;

    StringSink sink;
    renderSetupPage(model, sink);
    TEST_ASSERT_TRUE(sink.contains("<html lang=\"pl\">"));
    TEST_ASSERT_TRUE(sink.contains("value=\"Studio\""));
    TEST_ASSERT_TRUE(sink.contains("value=\"CAM1\""));
    TEST_ASSERT_TRUE(sink.contains("data-s=\"Studio &lt;5G&gt;\""));
    TEST_ASSERT_TRUE(sink.contains("(-60 dBm, WPA)"));
    TEST_ASSERT_TRUE(sink.contains("błędne hasło"));
    TEST_ASSERT_TRUE(sink.contains("„Nowa”"));
    TEST_ASSERT_TRUE(sink.contains("Nazwa lampki może mieć najwyżej 26 znaków"));
    TEST_ASSERT_TRUE(sink.contains("Puste pole zachowuje zapisane hasło."));
    TEST_ASSERT_TRUE(sink.contains("<input name=\"password\" type=\"password\" maxlength=\"64\" autocomplete=\"off\">"));
    TEST_ASSERT_FALSE(sink.contains("Lampka nie może połączyć się ze swoją siecią"));
}

void test_recovery_page_explains_itself() {
    SetupPageModel model;
    model.recovery = true;
    StringSink sink;
    renderSetupPage(model, sink);
    TEST_ASSERT_TRUE(sink.contains("cannot reach its Wi-Fi network"));
    TEST_ASSERT_TRUE(sink.contains("No networks found."));
    TEST_ASSERT_TRUE(sink.contains("No password stored yet."));
}

void test_saved_page_names_the_network() {
    StringSink sink;
    renderSavedPage(Language::en, "Studio & Co", sink);
    TEST_ASSERT_TRUE(sink.contains("connects to „Studio &amp; Co”."));
}

// --- Hub discovery --------------------------------------------------------------

void test_settings_without_hub_ip_are_valid() {
    Settings settings("x");
    settings.parse("station.ssid=Studio\nhub.id=1a2b3c4d\n");
    TEST_ASSERT_TRUE(settings.isValid());
    TEST_ASSERT_FALSE(settings.hasHubAddress());
    TEST_ASSERT_EQUAL_STRING("1a2b3c4d", settings.pinnedHubId());

    Settings wrong("x");
    wrong.parse("hub.id=CAM1\n");
    TEST_ASSERT_EQUAL_STRING("", wrong.pinnedHubId());
    TEST_ASSERT_EQUAL_size_t(1, wrong.warningCount());
}

void test_controller_says_it_looks_for_the_hub() {
    Settings settings("x");
    settings.parse("station.ssid=Studio\ntally.name=CAM1\n");
    LedEngine leds;
    FakePlatform platform;
    TallyController controller(settings, "00a1b2c3", leds, platform);
    controller.begin(0);
    controller.wifiGotIp(10);
    TEST_ASSERT_EQUAL_STRING("[INFO]  Looking for the hub (mDNS)", platform.console.back().c_str());
}

void test_hub_id_from_host_name() {
    char id[9];
    TEST_ASSERT_TRUE(hubIdFromHostName("gctally-hub-1a2b3c4d.local", id, sizeof(id)));
    TEST_ASSERT_EQUAL_STRING("1a2b3c4d", id);
    TEST_ASSERT_TRUE(hubIdFromHostName("gctally-hub-00ff00ff", id, sizeof(id)));
    TEST_ASSERT_EQUAL_STRING("00ff00ff", id);
    TEST_ASSERT_FALSE(hubIdFromHostName("gctally-hub-1a2b3c4d5.local", id, sizeof(id)));
    TEST_ASSERT_FALSE(hubIdFromHostName("printer.local", id, sizeof(id)));
    TEST_ASSERT_FALSE(hubIdFromHostName("gctally-hub-XYZ12345", id, sizeof(id)));
    TEST_ASSERT_FALSE(hubIdFromHostName(nullptr, id, sizeof(id)));
}

void test_choose_hub() {
    HubAnswer one[] = {{"gctally-hub-1a2b3c4d.local", 0x0a01a8c0, 7411}};
    // the same Hub seen on two interfaces, and another Hub
    HubAnswer two[] = {{"gctally-hub-1a2b3c4d.local", 0x0a01a8c0, 7411}, {"gctally-hub-1a2b3c4d.local", 0x0a01a8c0, 7411},
                       {"gctally-hub-99999999.local", 0x0b01a8c0, 7411}};
    size_t chosen = 99;

    TEST_ASSERT_TRUE(chooseHub(one, 0, "", chosen) == HubSearch::none);
    TEST_ASSERT_TRUE(chooseHub(one, 1, "", chosen) == HubSearch::found);
    TEST_ASSERT_EQUAL_size_t(0, chosen);
    TEST_ASSERT_TRUE(chooseHub(two, 2, "", chosen) == HubSearch::found);
    TEST_ASSERT_TRUE(chooseHub(two, 3, "", chosen) == HubSearch::several);
    TEST_ASSERT_TRUE(chooseHub(two, 3, "99999999", chosen) == HubSearch::found);
    TEST_ASSERT_EQUAL_size_t(2, chosen);
    TEST_ASSERT_TRUE(chooseHub(two, 3, "12345678", chosen) == HubSearch::pinnedMissing);
    TEST_ASSERT_TRUE(chooseHub(one, 0, "12345678", chosen) == HubSearch::none);

    HubAnswer other[] = {{"printer.local", 0x0c01a8c0, 631}, {"gctally-hub-1a2b3c4d.local", 0, 7411}};
    TEST_ASSERT_TRUE(chooseHub(other, 2, "", chosen) == HubSearch::none);
}

void test_hub_finder_searches_after_ip_and_backs_off() {
    HubFinder finder;
    TEST_ASSERT_FALSE(finder.searchDue(0, false));  // no Wi-Fi
    finder.wifiUp(100);
    TEST_ASSERT_TRUE(finder.searchDue(100, false));
    finder.searchDone(1100, HubSearch::none);
    TEST_ASSERT_FALSE(finder.searchDue(4099, false));
    TEST_ASSERT_TRUE(finder.searchDue(4100, false));
    finder.searchDone(5100, HubSearch::several);
    TEST_ASSERT_FALSE(finder.searchDue(11099, false));
    TEST_ASSERT_TRUE(finder.searchDue(11100, false));
    for (int i = 0; i < 5; i++) finder.searchDone(20000, HubSearch::none);
    TEST_ASSERT_FALSE(finder.searchDue(49999, false));  // at most 30 s
    TEST_ASSERT_TRUE(finder.searchDue(50000, false));
    TEST_ASSERT_EQUAL_UINT8(7, finder.failures());
}

void test_hub_finder_searches_again_when_the_hub_is_silent() {
    HubFinder finder;
    finder.wifiUp(0);
    finder.searchDone(1000, HubSearch::found);
    TEST_ASSERT_TRUE(finder.hasHub());
    TEST_ASSERT_FALSE(finder.searchDue(1000, false));  // give the Hub time to answer
    TEST_ASSERT_FALSE(finder.searchDue(5000, true));    // it does
    TEST_ASSERT_FALSE(finder.searchDue(60000, true));
    TEST_ASSERT_FALSE(finder.searchDue(60001, false));  // and goes silent
    TEST_ASSERT_FALSE(finder.searchDue(70000, false));
    TEST_ASSERT_TRUE(finder.searchDue(70001, false));
    finder.wifiDown();
    TEST_ASSERT_FALSE(finder.searchDue(80000, false));
}

void test_gateway_fallback_after_three_none_in_a_row() {
    GatewayFallback fallback;
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::none));
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::none));
    TEST_ASSERT_TRUE(fallback.searchDone(HubSearch::none));
    // stays applied already; does not re-fire every search after that
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::none));
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::none));
}

void test_gateway_fallback_resets_when_mdns_actually_works() {
    GatewayFallback fallback;
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::none));
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::none));
    // a Hub (or several) answered: multicast is not blocked here, so the
    // guess is irrelevant and the streak starts over
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::several));
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::none));
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::none));
    TEST_ASSERT_TRUE(fallback.searchDone(HubSearch::none));
}

void test_gateway_fallback_resets_once_a_hub_is_found() {
    GatewayFallback fallback;
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::none));
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::none));
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::found));
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::none));
    TEST_ASSERT_FALSE(fallback.searchDone(HubSearch::none));
    TEST_ASSERT_TRUE(fallback.searchDone(HubSearch::none));
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_parses_a_static_program_message);
    RUN_TEST(test_parses_the_unknown_flash_message);
    RUN_TEST(test_parses_the_highlight_message_and_lowercase_hex);
    RUN_TEST(test_ignores_surrounding_whitespace);
    RUN_TEST(test_rejects_malformed_messages);
    RUN_TEST(test_dim_rounds_up_like_lua);
    RUN_TEST(test_static_colour_is_shown_at_once);
    RUN_TEST(test_flash_pattern_steps_through_bits_msb_first);
    RUN_TEST(test_repeating_the_running_pattern_keeps_its_rhythm);
    RUN_TEST(test_a_different_pattern_restarts);
    RUN_TEST(test_static_after_flash_stops_the_pattern);
    RUN_TEST(test_status_patterns_match_v1);
    RUN_TEST(test_late_ticks_skip_steps);
    RUN_TEST(test_pattern_survives_millis_overflow);
    RUN_TEST(test_common_anode_inverts_pwm);
    RUN_TEST(test_common_cathode_keeps_pwm);
    RUN_TEST(test_ws2812_bytes_follow_the_configured_order);
    RUN_TEST(test_d1_mini_4x4_matrix);
    RUN_TEST(test_onboard_led_follows_v1_rule);
    RUN_TEST(test_settings_defaults);
    RUN_TEST(test_settings_reads_the_example_file);
    RUN_TEST(test_settings_password_may_contain_equals);
    RUN_TEST(test_settings_name_is_cut_to_26_characters);
    RUN_TEST(test_settings_warns_and_keeps_defaults);
    RUN_TEST(test_settings_ignores_comments_and_empty_values);
    RUN_TEST(test_host_name);
    RUN_TEST(test_log_buffer_keeps_order);
    RUN_TEST(test_log_buffer_pushes_out_the_oldest_lowest_severity);
    RUN_TEST(test_log_buffer_cuts_long_messages);
    RUN_TEST(test_invalid_settings_blink);
    RUN_TEST(test_hello_is_compatible_with_the_v1_parser);
    RUN_TEST(test_controller_connects_and_follows_the_hub);
    RUN_TEST(test_controller_shows_lost_hub_after_three_seconds);
    RUN_TEST(test_controller_buffers_logs_until_the_hub_answers);
    RUN_TEST(test_controller_logs_invalid_packets);
    RUN_TEST(test_controller_wifi_loss_blinks_and_stops_hello);
    RUN_TEST(test_settings_setup_keys);
    RUN_TEST(test_settings_rejects_a_short_setup_password);
    RUN_TEST(test_setup_password_is_printable_ascii);
    RUN_TEST(test_setup_password_from_settings_then_crew_then_generated);
    RUN_TEST(test_setup_led_pattern_is_purple);
    RUN_TEST(test_form_accepts_valid_input);
    RUN_TEST(test_form_rejects_invalid_input);
    RUN_TEST(test_ini_update_replaces_in_place_and_keeps_comments);
    RUN_TEST(test_ini_update_adds_and_removes_keys);
    RUN_TEST(test_ini_update_fails_when_the_result_does_not_fit);
    RUN_TEST(test_saved_form_reads_back_as_the_new_settings);
    RUN_TEST(test_supervisor_connects_at_once_and_backs_off);
    RUN_TEST(test_supervisor_retries_quickly_after_auth_expire_and_dhcp_timeout);
    RUN_TEST(test_supervisor_counts_a_silent_attempt_as_failed);
    RUN_TEST(test_supervisor_offers_recovery_ap_after_the_outage);
    RUN_TEST(test_supervisor_without_wifi_from_the_start_offers_recovery_ap);
    RUN_TEST(test_supervisor_recovery_ap_can_be_turned_off);
    RUN_TEST(test_supervisor_reconnects_rarely_while_the_recovery_ap_is_used);
    RUN_TEST(test_supervisor_trial_succeeds_with_an_ip);
    RUN_TEST(test_supervisor_trial_fails_after_the_timeout);
    RUN_TEST(test_classifies_disconnect_reasons);
    RUN_TEST(test_picks_the_page_language);
    RUN_TEST(test_escapes_html);
    RUN_TEST(test_setup_page_shows_settings_but_never_the_password);
    RUN_TEST(test_recovery_page_explains_itself);
    RUN_TEST(test_saved_page_names_the_network);
    RUN_TEST(test_settings_without_hub_ip_are_valid);
    RUN_TEST(test_controller_says_it_looks_for_the_hub);
    RUN_TEST(test_hub_id_from_host_name);
    RUN_TEST(test_choose_hub);
    RUN_TEST(test_hub_finder_searches_after_ip_and_backs_off);
    RUN_TEST(test_hub_finder_searches_again_when_the_hub_is_silent);
    RUN_TEST(test_gateway_fallback_after_three_none_in_a_row);
    RUN_TEST(test_gateway_fallback_resets_when_mdns_actually_works);
    RUN_TEST(test_gateway_fallback_resets_once_a_hub_is_found);
    return UNITY_END();
}
