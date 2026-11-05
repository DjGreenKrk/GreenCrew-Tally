#pragma once

#include <stddef.h>
#include <stdint.h>

namespace gctally {

// The USB-serial line protocol between the Hub and an ESP-NOW gateway (#25):
// one ESP8266/ESP32 plugged into the Hub by USB, relaying the same colour-
// state text the Hub already sends over UDP 7411 to tallies that have no
// Wi-Fi network, addressed by their MAC (there is no IP to use instead).
//
// Hub -> gateway, one per tally, at the Hub's normal UDP keep-alive rate:
//   "TO aabbccddeeff O255/000/000 S000/000/000\n"
// Gateway -> Hub, forwarding whatever a tally broadcast over ESP-NOW
// (its "tally-ho"/"log" text, unchanged):
//   "FROM aabbccddeeff tally-ho \"CAM1\" gc/1 id=aabbccddeeff\n"
// MAC addresses are 12 lowercase hex digits, no separators. This file has
// no Arduino/ESP-NOW dependency so it can be unit tested on a computer; the
// gateway firmware (src/gateway_main.cpp) is the only caller.

const size_t macHexLength = 12;
const size_t macBytes = 6;

// "aabbccddeeff" (any case) -> 6 raw bytes. False for anything else: wrong
// length or a non-hex character.
bool parseMacHex(const char* hex, size_t length, uint8_t mac[macBytes]);

// 6 raw bytes -> lowercase "aabbccddeeff". `out` must have room for
// macHexLength + 1 bytes.
void formatMacHex(const uint8_t mac[macBytes], char* out);

struct GatewaySendRequest {
    uint8_t mac[macBytes];
    // Points inside the `line` passed to parseGatewaySendLine, not a copy
    // and not null-terminated; valid only as long as that buffer is.
    const char* text;
    size_t textLength;
};

// Parses one line the Hub sent down the serial link ("TO <mac> <text>").
// `line` need not be null-terminated; a trailing "\r" and/or "\n" is
// ignored. False for anything that is not a well-formed TO line.
bool parseGatewaySendLine(const char* line, size_t length, GatewaySendRequest& out);

// Formats what the gateway sends up the serial link for a frame a tally
// broadcast ("FROM <mac> <text>\n"). False if `out` is too small for the
// result (including the trailing "\n" and the terminating '\0').
bool formatGatewayReceivedLine(const uint8_t mac[macBytes], const char* text, size_t textLength, char* out, size_t outSize);

}  // namespace gctally
