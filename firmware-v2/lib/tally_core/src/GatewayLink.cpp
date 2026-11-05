#include "GatewayLink.h"

#include <ctype.h>
#include <string.h>

namespace gctally {

namespace {

int hexValue(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

size_t withoutLineEnding(const char* line, size_t length) {
    while (length > 0 && (line[length - 1] == '\n' || line[length - 1] == '\r')) length--;
    return length;
}

}  // namespace

bool parseMacHex(const char* hex, size_t length, uint8_t mac[macBytes]) {
    if (length != macHexLength) return false;
    for (size_t i = 0; i < macBytes; i++) {
        int high = hexValue(hex[i * 2]);
        int low = hexValue(hex[i * 2 + 1]);
        if (high < 0 || low < 0) return false;
        mac[i] = static_cast<uint8_t>(high * 16 + low);
    }
    return true;
}

void formatMacHex(const uint8_t mac[macBytes], char* out) {
    const char* digits = "0123456789abcdef";
    for (size_t i = 0; i < macBytes; i++) {
        out[i * 2] = digits[mac[i] >> 4];
        out[i * 2 + 1] = digits[mac[i] & 0x0F];
    }
    out[macHexLength] = '\0';
}

bool parseGatewaySendLine(const char* line, size_t length, GatewaySendRequest& out) {
    length = withoutLineEnding(line, length);
    const char* prefix = "TO ";
    size_t prefixLength = strlen(prefix);
    if (length <= prefixLength + macHexLength + 1) return false;
    if (strncmp(line, prefix, prefixLength) != 0) return false;
    if (!parseMacHex(line + prefixLength, macHexLength, out.mac)) return false;
    size_t afterMac = prefixLength + macHexLength;
    if (line[afterMac] != ' ') return false;

    out.text = line + afterMac + 1;
    out.textLength = length - afterMac - 1;
    return out.textLength > 0;
}

bool formatGatewayReceivedLine(const uint8_t mac[macBytes], const char* text, size_t textLength, char* out, size_t outSize) {
    // "FROM " + mac + " " + text + "\n" + '\0'
    size_t needed = 5 + macHexLength + 1 + textLength + 1 + 1;
    if (needed > outSize) return false;

    size_t pos = 0;
    memcpy(out + pos, "FROM ", 5);
    pos += 5;
    formatMacHex(mac, out + pos);
    pos += macHexLength;
    out[pos++] = ' ';
    memcpy(out + pos, text, textLength);
    pos += textLength;
    out[pos++] = '\n';
    out[pos] = '\0';
    return true;
}

}  // namespace gctally
