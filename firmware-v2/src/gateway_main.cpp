// GC Tally ESP-NOW gateway (#25): one ESP8266 plugged into the Hub computer
// by USB, bridging the Hub's existing tally protocol onto ESP-NOW for tallies
// that have no Wi-Fi network to join. The line protocol on the serial link is
// in lib/tally_core/src/GatewayLink.h/.cpp (unit tested on a computer); this
// file is only the Arduino/ESP-NOW glue around it, same split as main.cpp and
// the rest of lib/tally_core.
//
// Built as its own PlatformIO environment (env:gateway_d1_mini), not part of
// the tally firmware: `pio run -e gateway_d1_mini -t upload`.

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <espnow.h>

#include "GatewayLink.h"

using namespace gctally;

namespace {

// Fixed channel: ESP-NOW peers must share one, and there is no access point
// here to take it from (see tally-settings.ini's transport.channel).
const uint8_t espNowChannel = 1;

char serialLine[96];
size_t serialLineLength = 0;

// Single-slot, like the tally's own onEspNowReceived: a frame arriving
// before loop() has written the previous one to Serial is dropped. Sized
// for the tally's own largest outgoing message (TallyController::sendLog's
// 160-byte buffer, the biggest of its hello/log senders, firmware-v2/lib/
// tally_core/src/TallyController.cpp), not the 25/34-byte downstream state
// text - a hello with a long name/firmware string must not be truncated.
volatile bool receivedPending = false;
uint8_t receivedMac[6];
uint8_t receivedData[200];
volatile uint8_t receivedLength = 0;

void onReceived(uint8_t* mac, uint8_t* data, uint8_t length) {
    if (receivedPending) return;
    memcpy(receivedMac, mac, 6);
    uint8_t copyLength = length < sizeof(receivedData) ? length : sizeof(receivedData);
    memcpy(receivedData, data, copyLength);
    receivedLength = copyLength;
    receivedPending = true;
}

// esp_now_add_peer fails if the peer already exists; the Hub has no reason
// to track which MACs were already added, so this treats "exists" as success.
void ensurePeer(const uint8_t mac[6]) {
    // Neither esp_now_is_peer_exist nor esp_now_add_peer accept a const
    // source in this SDK version; they only read from it.
    if (esp_now_is_peer_exist(const_cast<uint8_t*>(mac))) return;
    esp_now_add_peer(const_cast<uint8_t*>(mac), ESP_NOW_ROLE_COMBO, espNowChannel, nullptr, 0);
}

void handleSerialLine(const char* line, size_t length) {
    GatewaySendRequest request;
    if (!parseGatewaySendLine(line, length, request)) {
        Serial.println("[ERROR] Malformed line from the Hub");
        return;
    }
    ensurePeer(request.mac);
    // esp_now_send does not accept a const source; it only reads from it.
    esp_now_send(request.mac, reinterpret_cast<uint8_t*>(const_cast<char*>(request.text)), static_cast<uint8_t>(request.textLength));
}

}  // namespace

void setup() {
    Serial.begin(115200);
    Serial.println();

    WiFi.mode(WIFI_STA);
    WiFi.disconnect();
    wifi_set_channel(espNowChannel);

    if (esp_now_init() != 0) {
        Serial.println("[ERROR] ESP-NOW could not start");
        return;
    }
    esp_now_set_self_role(ESP_NOW_ROLE_COMBO);
    esp_now_register_recv_cb(onReceived);

    Serial.println("GATEWAY-HO gc-gateway/1");
}

void loop() {
    while (Serial.available() > 0) {
        char c = Serial.read();
        if (c == '\n') {
            handleSerialLine(serialLine, serialLineLength);
            serialLineLength = 0;
        } else if (serialLineLength < sizeof(serialLine) - 1) {
            serialLine[serialLineLength++] = c;
        }
        // A line longer than the buffer is silently truncated, like the
        // tally's own 64-byte udp.read() limit on the receiving end.
    }

    if (receivedPending) {
        char line[5 + macHexLength + 1 + sizeof(receivedData) + 2];
        if (formatGatewayReceivedLine(receivedMac, reinterpret_cast<const char*>(receivedData), receivedLength, line, sizeof(line))) {
            Serial.print(line);
        }
        receivedPending = false;
    }
}
