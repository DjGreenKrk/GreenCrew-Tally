#pragma once

#include <stdint.h>

#include "StateMessage.h"

namespace gctally {

// The two colours the lights show right now.
struct Frame {
    Color operatorColor;
    Color stageColor;

    bool operator==(const Frame& other) const { return operatorColor == other.operatorColor && stageColor == other.stageColor; }
    bool operator!=(const Frame& other) const { return !(*this == other); }
};

// Static colours and flash patterns, as in tally/src/my-led.lua: a dim step
// shows 30 % of the colour (rounded up), and starting the pattern that is
// already running does not restart it, so repeated keep-alives from the Hub
// do not disturb the rhythm.
class LedEngine {
public:
    static const uint8_t maxSteps = 16;

    void showStatic(const Color& operatorColor, const Color& stageColor);
    // steps: bit (length - 1) is the first step, bit 0 the last.
    void showFlash(const Color& operatorColor, const Color& stageColor, uint16_t steps, uint8_t length, uint16_t stepMs, uint32_t nowMs);
    void show(const StateMessage& message, uint32_t nowMs);

    // Status patterns of the tally itself (blue on the operator light).
    void showInitial();
    void showWaitForWifi(uint32_t nowMs);
    void showWaitForIp(uint32_t nowMs);
    void showWaitForHub(uint32_t nowMs);
    void showInvalidSettings(uint32_t nowMs);

    // Advances the pattern; true when frame() changed since the last call.
    bool tick(uint32_t nowMs);
    Frame frame() const { return current; }

    static Color dim(const Color& color);

private:
    void render();

    Color operatorColor;
    Color stageColor;
    bool flashing = false;
    uint16_t steps = 0;
    uint8_t length = 0;
    uint16_t stepMs = 0;
    uint8_t index = 0;
    uint32_t stepStartedMs = 0;
    Frame current;
    bool changed = true;
};

}  // namespace gctally
