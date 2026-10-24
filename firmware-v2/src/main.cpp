// GC Tally firmware v2 for ESP8266 (D1 Mini / NodeMCU boards).
// The hardware side: Wi-Fi, UDP, LittleFS and the pins. The tally logic is in
// lib/tally_core and is tested on a computer (pio test -e native).

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <LittleFS.h>
#include <NeoPixelBus.h>
#include <WiFiUdp.h>

#include "LedEngine.h"
#include "LightOutput.h"
#include "Settings.h"
#include "TallyController.h"

using namespace gctally;

namespace {

const uint16_t listenPort = 7411;
const char* settingsPath = "/tally-settings.ini";

// Same pins as tally/src/my-led.lua (NodeMCU numbering D1-D7)
const uint8_t pins[LightOutput::pinCount] = {
    D2, D1, D3,  // operator red, green, blue
    D6, D5, D7,  // stage red, green, blue
};
const uint8_t onboardLedPin = D0;  // LOW = on

char deviceId[9];
Settings* settings;
LedEngine leds;
WiFiUDP udp;
// WS2812 on D4 (GPIO2) through UART1, like NodeMCU's ws2812 module. Bytes
// are sent as given; LightOutput already puts them in GRB or RGB order.
NeoPixelBus<NeoRgbFeature, NeoEsp8266Uart1Ws2812xMethod>* strip;

class EspPlatform : public Platform {
public:
    void sendToHub(const char* text) override {
        if (udp.beginPacket(settings->hubAddress(), settings->hubUdpPort())) {
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
bool reconnectPending = false;
uint32_t reconnectAtMs = 0;

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

void connectWifi() {
    controller->wifiConnecting(millis());
    char text[64];
    snprintf(text, sizeof(text), "Connect to WiFi %s", settings->stationSsid());
    controller->log(Severity::info, text);
    WiFi.begin(settings->stationSsid(), settings->stationPassword());
}

void scheduleReconnect(uint32_t delayMs) {
    reconnectPending = true;
    reconnectAtMs = millis() + delayMs;
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
    // v1 uses the chip id without leading zeros as the default name
    char defaultName[9];
    snprintf(defaultName, sizeof(defaultName), "%x", ESP.getChipId());
    settings = new Settings(defaultName);

    // Read only: the tally never writes to flash while running.
    if (!LittleFS.begin()) {
        Serial.println("[ERROR] LittleFS could not be mounted");
        return;
    }
    File file = LittleFS.open(settingsPath, "r");
    if (!file) {
        Serial.printf("[WARN]  Configuration file %s does not exist. Using defaults.\n", settingsPath);
        return;
    }
    while (file.available()) {
        String line = file.readStringUntil('\n');
        settings->parseLine(line.c_str());
    }
    file.close();
    LittleFS.end();
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
    if (!settings->isValid()) return;

    onAssociated = WiFi.onStationModeConnected([](const WiFiEventStationModeConnected&) { eventAssociated = true; });
    onGotIp = WiFi.onStationModeGotIP([](const WiFiEventStationModeGotIP&) { eventGotIp = true; });
    onDisconnected = WiFi.onStationModeDisconnected([](const WiFiEventStationModeDisconnected& event) {
        disconnectReason = event.reason;
        eventDisconnected = true;
    });
    onDhcpTimeout = WiFi.onStationModeDHCPTimeout([]() { eventDhcpTimeout = true; });

    WiFi.mode(WIFI_STA);
    char hostName[40];
    settings->hostName(hostName, sizeof(hostName));
    WiFi.hostname(hostName);
    WiFi.setOutputPower(20.5);  // v1: wifi.setmaxtxpower(82), in 0.25 dBm
    udp.begin(listenPort);
    connectWifi();
}

void loop() {
    uint32_t now = millis();

    if (eventAssociated) {
        eventAssociated = false;
        char text[64];
        snprintf(text, sizeof(text), "Connected to %s. Waiting for IP.", settings->stationSsid());
        controller->log(Severity::info, text);
        controller->wifiAssociated(now);
    }
    if (eventGotIp) {
        eventGotIp = false;
        controller->log(Severity::info, ("Got IP " + WiFi.localIP().toString()).c_str());
        controller->wifiGotIp(now);
    }
    if (eventDisconnected) {
        eventDisconnected = false;
        char text[80];
        snprintf(text, sizeof(text), "Got disconnected from %s. Reason %u", settings->stationSsid(), disconnectReason);
        controller->wifiLost(now);
        controller->log(Severity::error, text);
        scheduleReconnect(disconnectReason == WIFI_DISCONNECT_REASON_AUTH_EXPIRE ? 200 : 2000);
    }
    if (eventDhcpTimeout) {
        eventDhcpTimeout = false;
        controller->wifiLost(now);
        controller->log(Severity::error, "DHCP timeout");
        WiFi.disconnect();
        scheduleReconnect(200);
    }
    if (reconnectPending && static_cast<int32_t>(now - reconnectAtMs) >= 0) {
        reconnectPending = false;
        connectWifi();
    }

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
