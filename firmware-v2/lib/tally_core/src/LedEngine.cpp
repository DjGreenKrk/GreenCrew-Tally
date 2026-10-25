#include "LedEngine.h"

#include <math.h>

namespace gctally {

namespace {

const Color blue = {0, 0, 255};
const Color black = {0, 0, 0};
const Color purple = {255, 0, 255};

// Pattern strings as in my-led.lua, written as bits: 1 = bright, 0 = dim.
const uint16_t waitForWifiSteps = 0b10;
const uint16_t waitForIpSteps = 0b1010;
const uint16_t waitForHubSteps = 0b101000;
const uint16_t invalidSettingsSteps = 0b101010000000;

}  // namespace

Color LedEngine::dim(const Color& color) {
    // Lua: math.ceil(value * 0.3); for 0-255 this is exactly 30 % rounded up
    Color result;
    result.r = static_cast<uint8_t>(ceil(color.r * 0.3));
    result.g = static_cast<uint8_t>(ceil(color.g * 0.3));
    result.b = static_cast<uint8_t>(ceil(color.b * 0.3));
    return result;
}

void LedEngine::showStatic(const Color& newOperatorColor, const Color& newStageColor) {
    flashing = false;
    operatorColor = newOperatorColor;
    stageColor = newStageColor;
    render();
}

void LedEngine::showFlash(const Color& newOperatorColor, const Color& newStageColor, uint16_t newSteps, uint8_t newLength, uint16_t newStepMs, uint32_t nowMs) {
    if (newLength == 0 || newLength > maxSteps || newStepMs == 0) {
        showStatic(newOperatorColor, newStageColor);
        return;
    }
    if (flashing && operatorColor == newOperatorColor && stageColor == newStageColor && steps == newSteps && length == newLength && stepMs == newStepMs) {
        // the same pattern is already running; restarting it would break the rhythm
        return;
    }
    flashing = true;
    operatorColor = newOperatorColor;
    stageColor = newStageColor;
    steps = newSteps;
    length = newLength;
    stepMs = newStepMs;
    index = 0;
    stepStartedMs = nowMs;
    render();
}

void LedEngine::show(const StateMessage& message, uint32_t nowMs) {
    if (message.flashing) {
        showFlash(message.operatorColor, message.stageColor, message.pattern, 8, message.stepMs, nowMs);
    } else {
        showStatic(message.operatorColor, message.stageColor);
    }
}

void LedEngine::showInitial() { showStatic(blue, black); }
void LedEngine::showWaitForWifi(uint32_t nowMs) { showFlash(blue, black, waitForWifiSteps, 2, 500, nowMs); }
void LedEngine::showWaitForIp(uint32_t nowMs) { showFlash(blue, black, waitForIpSteps, 4, 250, nowMs); }
void LedEngine::showWaitForHub(uint32_t nowMs) { showFlash(blue, black, waitForHubSteps, 6, 150, nowMs); }
void LedEngine::showInvalidSettings(uint32_t nowMs) { showFlash(blue, black, invalidSettingsSteps, 12, 150, nowMs); }
void LedEngine::showSetup(uint32_t nowMs) { showFlash(purple, black, 0b10, 2, 1000, nowMs); }

bool LedEngine::tick(uint32_t nowMs) {
    if (flashing) {
        uint32_t elapsed = nowMs - stepStartedMs;  // wraps correctly after 49 days
        if (elapsed >= stepMs) {
            // late ticks skip steps instead of rushing through them
            uint32_t passed = elapsed / stepMs;
            index = (index + passed) % length;
            stepStartedMs += passed * stepMs;
            render();
        }
    }
    bool result = changed;
    changed = false;
    return result;
}

void LedEngine::render() {
    Frame next;
    bool bright = !flashing || (steps >> (length - 1 - index)) & 1;
    next.operatorColor = bright ? operatorColor : dim(operatorColor);
    next.stageColor = bright ? stageColor : dim(stageColor);
    if (next != current) {
        current = next;
        changed = true;
    }
}

}  // namespace gctally
