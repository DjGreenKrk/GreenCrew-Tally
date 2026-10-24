#pragma once

#include <stddef.h>
#include <stdint.h>

namespace gctally {

struct Color {
    uint8_t r = 0;
    uint8_t g = 0;
    uint8_t b = 0;

    bool operator==(const Color& other) const { return r == other.r && g == other.g && b == other.b; }
    bool operator!=(const Color& other) const { return !(*this == other); }
};

// What the Hub sends on UDP 7411, unchanged from the NodeMCU firmware:
//   "O255/000/000 S255/000/000"              a static colour
//   "O000/000/255 S000/000/000 0x80 250"     a flash pattern
// O = operator light, S = stage light. The pattern is 8 steps, most
// significant bit first (1 = bright, 0 = dim), each step lasting the given ms.
struct StateMessage {
    Color operatorColor;
    Color stageColor;
    bool flashing = false;
    uint8_t pattern = 0;
    uint16_t stepMs = 0;
};

// Returns false for anything that is not a state message; leading and
// trailing whitespace (the Hub adds none, a "\n" from tools is fine) is ignored.
bool parseStateMessage(const char* data, size_t length, StateMessage& out);

}  // namespace gctally
