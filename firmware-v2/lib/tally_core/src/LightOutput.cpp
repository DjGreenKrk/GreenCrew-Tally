#include "LightOutput.h"

namespace gctally {

namespace {

uint8_t pinLevel(uint8_t value, LightType type) {
    return type == LightType::commonAnode ? 255 - value : value;
}

uint8_t* appendWs2812(uint8_t* out, const Color& color, uint8_t lights, Ws2812Order order) {
    for (uint8_t i = 0; i < lights; i++) {
        *out++ = order == Ws2812Order::grb ? color.g : color.r;
        *out++ = order == Ws2812Order::grb ? color.r : color.g;
        *out++ = color.b;
    }
    return out;
}

}  // namespace

LightOutput LightOutput::from(const Frame& frame, const Settings& settings) {
    LightOutput output;
    const Color& op = frame.operatorColor;
    const Color& st = frame.stageColor;

    output.pwm[operatorRed] = pinLevel(op.r, settings.operatorType);
    output.pwm[operatorGreen] = pinLevel(op.g, settings.operatorType);
    output.pwm[operatorBlue] = pinLevel(op.b, settings.operatorType);
    output.pwm[stageRed] = pinLevel(st.r, settings.stageType);
    output.pwm[stageGreen] = pinLevel(st.g, settings.stageType);
    output.pwm[stageBlue] = pinLevel(st.b, settings.stageType);

    uint8_t* out = appendWs2812(output.ws2812, op, settings.operatorWs2812Lights, settings.operatorWs2812Order);
    appendWs2812(out, st, settings.stageWs2812Lights, settings.stageWs2812Order);
    output.ws2812Lights = settings.operatorWs2812Lights + settings.stageWs2812Lights;

    bool dimBlue = op.r == 0 && op.g == 0 && op.b < 255;
    bool dimGrey = op.r == op.g && op.g == op.b && op.b < 255;
    output.onboardLedOn = !(dimBlue || dimGrey);
    return output;
}

}  // namespace gctally
