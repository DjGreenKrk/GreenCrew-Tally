#include "TallyController.h"

#include <stdio.h>
#include <string.h>

#include "StateMessage.h"

#ifndef GC_FIRMWARE_VERSION
#define GC_FIRMWARE_VERSION "0.0.0"
#endif

namespace gctally {

TallyController::TallyController(const Settings& settings, const char* deviceId, LedEngine& leds, Platform& platform)
    : settings(settings), deviceId(deviceId), leds(leds), platform(platform) {}

void TallyController::begin(uint32_t nowMs) {
    lastHelloMs = nowMs;
    lastFlushMs = nowMs;
    if (settings.isValid()) {
        leds.showInitial();
    } else {
        leds.showInvalidSettings(nowMs);
    }
}

void TallyController::wifiConnecting(uint32_t nowMs) {
    wifiUp = false;
    leds.showWaitForWifi(nowMs);
}

void TallyController::wifiAssociated(uint32_t nowMs) {
    wifiUp = false;
    leds.showWaitForIp(nowMs);
}

void TallyController::wifiGotIp(uint32_t nowMs) {
    wifiUp = true;
    leds.showWaitForHub(nowMs);
    char text[96];
    if (settings.hasHubAddress()) {
        snprintf(text, sizeof(text), "Contacting hub on %s:%u", settings.hubAddress(), settings.hubUdpPort());
    } else {
        snprintf(text, sizeof(text), "Looking for the hub (mDNS)");
    }
    log(Severity::info, text);
    sendHello();
}

void TallyController::wifiLost(uint32_t nowMs) {
    wifiUp = false;
    leds.showWaitForWifi(nowMs);
}

void TallyController::packetReceived(const char* data, size_t length, uint32_t nowMs) {
    hasPacket = true;
    lastPacketMs = nowMs;
    StateMessage message;
    if (parseStateMessage(data, length, message)) {
        leds.show(message, nowMs);
    } else {
        char text[LogBuffer::maxMessageLength + 1];
        snprintf(text, sizeof(text), "invalid package: %.*s", static_cast<int>(length < 60 ? length : 60), data);
        log(Severity::warning, text);
    }
}

bool TallyController::isHubConnected(uint32_t nowMs) const {
    return hasPacket && nowMs - lastPacketMs <= hubTimeoutMs;
}

void TallyController::tick(uint32_t nowMs) {
    if (nowMs - lastHelloMs >= helloIntervalMs) {
        lastHelloMs = nowMs;
        if (wifiUp) {
            if (!isHubConnected(nowMs)) leds.showWaitForHub(nowMs);
            sendHello();
        }
    }
    if (nowMs - lastFlushMs >= logFlushIntervalMs) {
        lastFlushMs = nowMs;
        if (wifiUp && isHubConnected(nowMs) && buffer.hasLog()) {
            Severity severity;
            char message[LogBuffer::maxMessageLength + 1];
            buffer.take(severity, message, sizeof(message));
            sendLog(severity, message);
        }
    }
}

void TallyController::log(Severity severity, const char* message) {
    char line[LogBuffer::maxMessageLength + 16];
    char label[10];
    snprintf(label, sizeof(label), "[%s]", severityName(severity));
    snprintf(line, sizeof(line), "%-7s %s", label, message);
    platform.printLine(line);

    if (wifiUp && !buffer.hasLog()) {
        sendLog(severity, message);
    } else {
        buffer.add(severity, message);
    }
}

void TallyController::helloMessage(char* out, size_t size) const {
    snprintf(out, size, "tally-ho \"%s\" gc/%u id=%s fw=%s hw=esp8266 caps=ws2812,pwm", settings.tallyName(), protocolVersion, deviceId, GC_FIRMWARE_VERSION);
}

void TallyController::sendHello() {
    char text[128];
    helloMessage(text, sizeof(text));
    strncat(text, "\n", sizeof(text) - strlen(text) - 1);
    platform.sendToHub(text);
}

void TallyController::sendLog(Severity severity, const char* message) {
    char text[160];
    snprintf(text, sizeof(text), "log \"%s\" %s \"%s\"\n", settings.tallyName(), severityName(severity), message);
    platform.sendToHub(text);
}

}  // namespace gctally
