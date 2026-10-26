#include "StateMessage.h"

#include <ctype.h>

namespace gctally {

namespace {

bool readDecimal(const char* text, size_t digits, uint16_t& out) {
    uint16_t value = 0;
    for (size_t i = 0; i < digits; i++) {
        if (!isdigit(static_cast<unsigned char>(text[i]))) return false;
        value = value * 10 + (text[i] - '0');
    }
    out = value;
    return true;
}

bool readColor(const char* text, Color& out) {
    // "255/000/000"
    uint16_t r, g, b;
    if (!readDecimal(text, 3, r) || text[3] != '/' || !readDecimal(text + 4, 3, g) || text[7] != '/' || !readDecimal(text + 8, 3, b)) {
        return false;
    }
    if (r > 255 || g > 255 || b > 255) return false;
    out.r = r;
    out.g = g;
    out.b = b;
    return true;
}

int hexDigit(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

}  // namespace

bool parseStateMessage(const char* data, size_t length, StateMessage& out) {
    while (length > 0 && isspace(static_cast<unsigned char>(data[0]))) {
        data++;
        length--;
    }
    while (length > 0 && isspace(static_cast<unsigned char>(data[length - 1]))) {
        length--;
    }
    if (length != 25 && length != 34) return false;

    StateMessage message;
    if (data[0] != 'O' || !readColor(data + 1, message.operatorColor)) return false;
    if (data[12] != ' ' || data[13] != 'S' || !readColor(data + 14, message.stageColor)) return false;

    if (length == 34) {
        if (data[25] != ' ' || data[26] != '0' || data[27] != 'x' || data[30] != ' ') return false;
        int high = hexDigit(data[28]);
        int low = hexDigit(data[29]);
        uint16_t stepMs;
        if (high < 0 || low < 0 || !readDecimal(data + 31, 3, stepMs)) return false;
        message.flashing = true;
        message.pattern = static_cast<uint8_t>(high * 16 + low);
        message.stepMs = stepMs;
    }

    out = message;
    return true;
}

}  // namespace gctally
