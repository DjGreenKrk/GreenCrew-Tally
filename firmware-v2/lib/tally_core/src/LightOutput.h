#pragma once

#include <stdint.h>

#include "LedEngine.h"
#include "Settings.h"

namespace gctally {

// What to write to the pins for one frame, as in showColor() in
// tally/src/my-led.lua. PWM values are 0-255 for the pin level (255 = HIGH
// all the time), so a common anode light gets the inverted value.
struct LightOutput {
    enum Pin { operatorRed, operatorGreen, operatorBlue, stageRed, stageGreen, stageBlue, pinCount };
    static const uint8_t maxWs2812Lights = 2 * Settings::maxWs2812Lights;

    uint8_t pwm[pinCount] = {};
    // The on-board LED (D0) has no PWM: it is on unless the frame is a dim
    // or dark blue/grey step, so it still blinks with the status patterns.
    bool onboardLedOn = true;
    // Bytes in the order they go out on the wire: operator lights first,
    // then stage lights, three bytes each in the configured order.
    uint8_t ws2812[maxWs2812Lights * 3] = {};
    uint8_t ws2812Lights = 0;

    static LightOutput from(const Frame& frame, const Settings& settings);
};

}  // namespace gctally
