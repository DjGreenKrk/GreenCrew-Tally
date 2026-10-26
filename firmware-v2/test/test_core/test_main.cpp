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
#include "StateMessage.h"
#include "TallyController.h"

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
    return UNITY_END();
}
