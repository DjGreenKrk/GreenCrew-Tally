// GC Tally firmware v2 for ESP8266 (D1 Mini / NodeMCU boards).
// The hardware side: Wi-Fi, UDP, LittleFS and the pins. The tally logic is in
// lib/tally_core and is tested on a computer (pio test -e native).

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>
#include <NeoPixelBus.h>
#include <WiFiUdp.h>

#include "ConfigStore.h"
#include "HubFinder.h"
#include "LedEngine.h"
#include "LightOutput.h"
#include "Portal.h"
#include "Settings.h"
#include "TallyController.h"
#include "WifiSupervisor.h"

using namespace gctally;

namespace {

const uint16_t listenPort = 7411;
// Pressing reset again within this time after a reset opens the setup mode.
const uint32_t doubleResetWindowMs = 3000;
// Setup mode of a configured tally ends after this long without use.
const uint32_t setupIdleMs = 5 * 60 * 1000;

// Same pins as tally/src/my-led.lua (NodeMCU numbering D1-D7)
const uint8_t pins[LightOutput::pinCount] = {
    D2, D1, D3,  // operator red, green, blue
    D6, D5, D7,  // stage red, green, blue
};
const uint8_t onboardLedPin = D0;  // LOW = on

// Kept in the RTC memory: survives the reset button and ESP.restart(), not a
// power loss. Nothing of it goes to flash.
struct RtcState {
    uint32_t magic;
    uint32_t resetPressed;   // 1 during the first seconds after a boot
    uint32_t trialFailure;   // WifiFailure of the last trial, to show on the setup page
    char trialSsid[36];
};
const uint32_t rtcMagic = 0x47435432;  // "GCT2"
RtcState rtc;

char deviceId[9];
char apName[32];
String setupPassword;
Settings* settings;
bool setupMode = false;
ConfigStore::Boot boot = ConfigStore::Boot::committed;
WifiSupervisor* supervisor;
bool trialCommitted = false;
WifiFailure shownTrialFailure = WifiFailure::none;
char shownTrialSsid[36] = "";
uint32_t lastApCheckMs = 0;
// Without hub.ip: the Hub found over mDNS. Kept in RAM only.
HubFinder hubFinder;
IPAddress foundHubIp;
uint16_t foundHubPort = 0;
bool mdnsStarted = false;
LedEngine leds;
WiFiUDP udp;
// WS2812 on D4 (GPIO2) through UART1, like NodeMCU's ws2812 module. Bytes
// are sent as given; LightOutput already puts them in GRB or RGB order.
NeoPixelBus<NeoRgbFeature, NeoEsp8266Uart1Ws2812xMethod>* strip;

class EspPlatform : public Platform {
public:
    void sendToHub(const char* text) override {
        int ready;
        if (settings->hasHubAddress()) {
            ready = udp.beginPacket(settings->hubAddress(), settings->hubUdpPort());
        } else if (hubFinder.hasHub()) {
            ready = udp.beginPacket(foundHubIp, foundHubPort);
        } else {
            return;  // still looking; logs stay in the buffer
        }
        if (ready) {
            udp.write(text, strlen(text));
            udp.endPacket();
        }
    }
    void printLine(const char* text) override { Serial.println(text); }
};
EspPlatform platform;
TallyController* controller;

// Wi-Fi events arrive from the SDK; they are only recorded here and handled
// in loop().
volatile bool eventAssociated = false;
volatile bool eventGotIp = false;
volatile bool eventDisconnected = false;
volatile bool eventDhcpTimeout = false;
volatile uint8_t disconnectReason = 0;
WiFiEventHandler onAssociated, onGotIp, onDisconnected, onDhcpTimeout;

void writeRtc() { ESP.rtcUserMemoryWrite(0, reinterpret_cast<uint32_t*>(&rtc), sizeof(rtc)); }

void readRtc() {
    if (!ESP.rtcUserMemoryRead(0, reinterpret_cast<uint32_t*>(&rtc), sizeof(rtc)) || rtc.magic != rtcMagic) {
        memset(&rtc, 0, sizeof(rtc));
        rtc.magic = rtcMagic;
    }
    rtc.trialSsid[sizeof(rtc.trialSsid) - 1] = '\0';
}

void restartTally() {
    rtc.resetPressed = 0;  // our own restart is not a double reset
    writeRtc();
    Serial.println("[INFO]  Restarting");
    delay(100);
    ESP.restart();
}

void writeLights() {
    LightOutput output = LightOutput::from(leds.frame(), *settings);
    for (uint8_t i = 0; i < LightOutput::pinCount; i++) analogWrite(pins[i], output.pwm[i]);
    digitalWrite(onboardLedPin, output.onboardLedOn ? LOW : HIGH);
    if (strip != nullptr) {
        for (uint8_t i = 0; i < output.ws2812Lights; i++) {
            const uint8_t* bytes = output.ws2812 + 3 * i;
            strip->SetPixelColor(i, RgbColor(bytes[0], bytes[1], bytes[2]));
        }
        strip->Show();
    }
}

void connectWifi(uint32_t now) {
    controller->wifiConnecting(now);
    supervisor->connectStarted(now);
    char text[64];
    snprintf(text, sizeof(text), "Connect to WiFi %s", settings->stationSsid());
    controller->log(Severity::info, text);
    WiFi.begin(settings->stationSsid(), settings->stationPassword());
}

void logRetry() {
    char text[48];
    snprintf(text, sizeof(text), "Trying again in %u ms", supervisor->retryDelayMs());
    controller->log(Severity::info, text);
}

void logBootReason() {
    rst_info* info = ESP.getResetInfoPtr();
    String reason = ESP.getResetReason();
    bool watchdog = info->reason == REASON_WDT_RST || info->reason == REASON_SOFT_WDT_RST;
    bool exception = info->reason == REASON_EXCEPTION_RST;
    controller->log(watchdog || exception ? Severity::error : Severity::info, ("booted because of " + reason).c_str());
    if (exception) {
        char text[80];
        snprintf(text, sizeof(text), "exception %u at 0x%08x, address 0x%08x", info->exccause, info->epc1, info->excvaddr);
        controller->log(Severity::error, text);
    }
}

void readSettings() {
    snprintf(deviceId, sizeof(deviceId), "%06x", ESP.getChipId());
    snprintf(apName, sizeof(apName), "GreenCrew-Tally-%s", deviceId);
    // v1 uses the chip id without leading zeros as the default name
    char defaultName[9];
    snprintf(defaultName, sizeof(defaultName), "%x", ESP.getChipId());
    settings = new Settings(defaultName);

    // Mounting formats an empty flash, so a freshly flashed board works.
    if (!ConfigStore::begin()) {
        Serial.println("[ERROR] LittleFS could not be mounted");
        return;
    }
    boot = ConfigStore::prepare();
    if (boot == ConfigStore::Boot::interruptedTrial) {
        // Power was lost or the tally crashed while trying new settings.
        Settings interrupted("");
        interrupted.parse(ConfigStore::readSettings(boot).c_str());
        rtc.trialFailure = static_cast<uint32_t>(WifiFailure::other);
        strncpy(rtc.trialSsid, interrupted.stationSsid(), sizeof(rtc.trialSsid) - 1);
        writeRtc();
        ConfigStore::dropTrial();
        boot = ConfigStore::Boot::committed;
    }
    String text = ConfigStore::readSettings(boot);
    if (text.length() == 0 && boot == ConfigStore::Boot::committed) {
        Serial.println("[WARN]  Configuration file /tally-settings.ini does not exist. Using defaults.");
    }
    settings->parse(text.c_str());
    setupPassword = settings->setupPassword()[0] != '\0' ? String(settings->setupPassword()) : ConfigStore::setupKey();
}

void startSetupMode() {
    shownTrialFailure = static_cast<WifiFailure>(rtc.trialFailure);
    strncpy(shownTrialSsid, rtc.trialSsid, sizeof(shownTrialSsid) - 1);
    rtc.trialFailure = 0;
    writeRtc();

    // Only on the serial console: logs also go to the Hub.
    Serial.printf("[INFO]  Setup access point %s, password %s, page http://192.168.4.1/\n", apName, setupPassword.c_str());
    controller->log(Severity::info, "Setup mode");
    leds.showSetup(millis());
    Portal::start(apName, setupPassword.c_str(), {deviceId, settings, false, shownTrialFailure, shownTrialSsid});
}

void startStation() {
    onAssociated = WiFi.onStationModeConnected([](const WiFiEventStationModeConnected&) { eventAssociated = true; });
    onGotIp = WiFi.onStationModeGotIP([](const WiFiEventStationModeGotIP&) { eventGotIp = true; });
    onDisconnected = WiFi.onStationModeDisconnected([](const WiFiEventStationModeDisconnected& event) {
        disconnectReason = event.reason;
        eventDisconnected = true;
    });
    onDhcpTimeout = WiFi.onStationModeDHCPTimeout([]() { eventDhcpTimeout = true; });

    if (boot == ConfigStore::Boot::trial) controller->log(Severity::info, "Trying the new settings");
    supervisor = new WifiSupervisor(settings->recoveryAfterMs(), boot == ConfigStore::Boot::trial);
    WiFi.mode(WIFI_STA);
    char hostName[40];
    settings->hostName(hostName, sizeof(hostName));
    WiFi.hostname(hostName);
    WiFi.setOutputPower(20.5);  // v1: wifi.setmaxtxpower(82), in 0.25 dBm
    udp.begin(listenPort);
    supervisor->begin(millis());
}

// mDNS: the tally announces itself (_gctally-device._udp, for the Hub's device
// list in a later step of #28) and, without hub.ip, looks for the Hub.
void startMdns() {
    if (mdnsStarted) return;
    char hostName[40];
    settings->hostName(hostName, sizeof(hostName));
    if (!MDNS.begin(hostName)) {
        controller->log(Severity::warning, "mDNS could not start");
        return;
    }
    mdnsStarted = true;
    MDNSResponder::hMDNSService service = MDNS.addService(nullptr, "gctally-device", "udp", listenPort);
    MDNS.addServiceTxt(service, "v", "1");
    MDNS.addServiceTxt(service, "id", deviceId);
    MDNS.addServiceTxt(service, "fw", GC_FIRMWARE_VERSION);
    MDNS.addServiceTxt(service, "name", settings->tallyName());
}

void logSearch(HubSearch result, const HubAnswer* answers, uint32_t count) {
    // the diagnosis once per failure streak, then every 10th time
    if (result != HubSearch::found && hubFinder.failures() % 10 != 1) return;
    char text[LogBuffer::maxMessageLength + 1];
    switch (result) {
        case HubSearch::found:
            return;
        case HubSearch::none:
            snprintf(text, sizeof(text), "No hub found (mDNS). Hub not running, or multicast blocked: set hub.ip");
            break;
        case HubSearch::several: {
            size_t used = snprintf(text, sizeof(text), "Several hubs found, set hub.id:");
            char id[9];
            for (uint32_t i = 0; i < count && used < sizeof(text); i++) {
                if (hubIdFromHostName(answers[i].hostName, id, sizeof(id))) used += snprintf(text + used, sizeof(text) - used, " %s", id);
            }
            break;
        }
        case HubSearch::pinnedMissing:
            snprintf(text, sizeof(text), "Hub %s (hub.id) not found, only other hubs answered", settings->pinnedHubId());
            break;
    }
    controller->log(Severity::warning, text);
}

void searchHub() {
    const uint32_t maxAnswers = 8;
    uint32_t count = MDNS.queryService("gctally", "udp", 1000);
    if (count > maxAnswers) count = maxAnswers;
    HubAnswer answers[maxAnswers];
    String hostNames[maxAnswers];
    for (uint32_t i = 0; i < count; i++) {
        hostNames[i] = MDNS.answerHostname(i);
        answers[i] = {hostNames[i].c_str(), static_cast<uint32_t>(MDNS.answerIP(i)), MDNS.answerPort(i)};
    }
    MDNS.removeQuery();

    size_t chosen = 0;
    HubSearch result = chooseHub(answers, count, settings->pinnedHubId(), chosen);
    hubFinder.searchDone(millis(), result);
    logSearch(result, answers, count);
    if (result != HubSearch::found) return;

    IPAddress ip(answers[chosen].ip);
    bool changed = ip != foundHubIp || answers[chosen].port != foundHubPort;
    foundHubIp = ip;
    foundHubPort = answers[chosen].port;
    if (changed) {
        char id[9];
        hubIdFromHostName(answers[chosen].hostName, id, sizeof(id));
        char text[80];
        snprintf(text, sizeof(text), "Found hub %s at %s:%u", id, foundHubIp.toString().c_str(), foundHubPort);
        controller->log(Severity::info, text);
    }
}

void loopSetupMode(uint32_t now) {
    // A configured tally goes back to work when nobody uses the page.
    if (settings->isValid() && now - Portal::lastRequestMs() > setupIdleMs && WiFi.softAPgetStationNum() == 0) restartTally();
}

void checkTrial(uint32_t now) {
    WifiSupervisor::Trial trial = supervisor->trial(now);
    if (trial == WifiSupervisor::Trial::succeeded && !trialCommitted) {
        trialCommitted = true;
        if (ConfigStore::commitTrial()) {
            controller->log(Severity::info, "The new settings work and are saved");
        } else {
            controller->log(Severity::error, "Could not save the new settings");
        }
    } else if (trial == WifiSupervisor::Trial::failed) {
        // Back to the setup page with the reason; the committed settings stay.
        WifiFailure failure = supervisor->lastFailure();
        rtc.trialFailure = static_cast<uint32_t>(failure == WifiFailure::none ? WifiFailure::other : failure);
        strncpy(rtc.trialSsid, settings->stationSsid(), sizeof(rtc.trialSsid) - 1);
        writeRtc();
        ConfigStore::dropTrial();
        Serial.println("[ERROR] The new settings did not connect, they are dropped");
        restartTally();
    }
}

void checkRecoveryAp(uint32_t now) {
    if (now - lastApCheckMs < 500) return;
    lastApCheckMs = now;
    supervisor->setApClients(Portal::isRunning() ? WiFi.softAPgetStationNum() : 0);
    bool wanted = supervisor->recoveryApWanted(now);
    if (wanted && !Portal::isRunning()) {
        Serial.printf("[INFO]  Recovery access point %s, page http://192.168.4.1/\n", apName);
        controller->log(Severity::warning, "No Wi-Fi for a while, recovery access point started");
        Portal::start(apName, setupPassword.c_str(), {deviceId, settings, true, WifiFailure::none, ""});
    } else if (!wanted && Portal::isRunning()) {
        Portal::stop();
        controller->log(Severity::info, "Recovery access point stopped");
    }
}

}  // namespace

void setup() {
    Serial.begin(115200);
    Serial.println();

    pinMode(onboardLedPin, OUTPUT);
    digitalWrite(onboardLedPin, LOW);  // something is running
    analogWriteRange(255);
    analogWriteFreq(1000);
    for (uint8_t pin : pins) pinMode(pin, OUTPUT);

    // No implicit flash writes by the SDK, no connection before ours
    WiFi.persistent(false);
    WiFi.setAutoConnect(false);
    WiFi.setAutoReconnect(false);
    WiFi.mode(WIFI_OFF);

    readRtc();
    bool doubleReset = rtc.resetPressed == 1 && ESP.getResetInfoPtr()->reason == REASON_EXT_SYS_RST;
    rtc.resetPressed = 1;
    writeRtc();

    readSettings();
    if (settings->operatorWs2812Lights + settings->stageWs2812Lights > 0) {
        strip = new NeoPixelBus<NeoRgbFeature, NeoEsp8266Uart1Ws2812xMethod>(settings->operatorWs2812Lights + settings->stageWs2812Lights);
        strip->Begin();
    }

    controller = new TallyController(*settings, deviceId, leds, platform);
    char text[80];
    snprintf(text, sizeof(text), "GC Tally firmware %s, device %s", GC_FIRMWARE_VERSION, deviceId);
    controller->log(Severity::info, text);
    logBootReason();
    for (size_t i = 0; i < settings->warningCount(); i++) controller->log(Severity::warning, settings->warning(i));

    controller->begin(millis());
    setupMode = !settings->isValid() || doubleReset || rtc.trialFailure != 0;
    if (setupMode) {
        startSetupMode();
    } else {
        startStation();
    }
}

void loop() {
    uint32_t now = millis();

    if (rtc.resetPressed == 1 && now >= doubleResetWindowMs) {
        rtc.resetPressed = 0;
        writeRtc();
    }
    Portal::handle();
    uint32_t restartAtMs;
    if (Portal::restartRequested(restartAtMs) && static_cast<int32_t>(now - restartAtMs) >= 0) restartTally();

    if (setupMode) {
        loopSetupMode(now);
        if (leds.tick(now)) writeLights();
        delay(1);
        return;
    }

    if (eventAssociated) {
        eventAssociated = false;
        char text[64];
        snprintf(text, sizeof(text), "Connected to %s. Waiting for IP.", settings->stationSsid());
        controller->log(Severity::info, text);
        controller->wifiAssociated(now);
    }
    if (eventGotIp) {
        eventGotIp = false;
        supervisor->gotIp(now);
        startMdns();
        hubFinder.wifiUp(now);
        controller->log(Severity::info, ("Got IP " + WiFi.localIP().toString()).c_str());
        controller->wifiGotIp(now);
    }
    if (eventDisconnected) {
        eventDisconnected = false;
        char text[80];
        snprintf(text, sizeof(text), "Got disconnected from %s. Reason %u", settings->stationSsid(), disconnectReason);
        supervisor->lost(now, disconnectReason);
        hubFinder.wifiDown();
        controller->wifiLost(now);
        controller->log(Severity::error, text);
        logRetry();
    }
    if (eventDhcpTimeout) {
        eventDhcpTimeout = false;
        supervisor->dhcpTimeout(now);
        hubFinder.wifiDown();
        controller->wifiLost(now);
        controller->log(Severity::error, "DHCP timeout");
        WiFi.disconnect();
        logRetry();
    }
    if (supervisor->connectDue(now)) connectWifi(now);
    if (mdnsStarted) MDNS.update();
    if (!settings->hasHubAddress() && hubFinder.searchDue(now, controller->isHubConnected(now))) {
        searchHub();
        now = millis();  // the search takes a second
    }
    checkTrial(now);
    checkRecoveryAp(now);

    int size = udp.parsePacket();
    if (size > 0) {
        char packet[64];
        int length = udp.read(packet, sizeof(packet) - 1);
        udp.flush();
        if (length > 0) controller->packetReceived(packet, length, now);
    }

    controller->tick(now);
    if (leds.tick(now)) writeLights();
    delay(1);
}
