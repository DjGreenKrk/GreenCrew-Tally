#pragma once

#include <stddef.h>
#include <stdint.h>

#include "LedEngine.h"
#include "LogBuffer.h"
#include "Settings.h"

namespace gctally {

// The hardware side the controller talks to.
class Platform {
public:
    virtual ~Platform() {}
    // One UDP datagram to the Hub (hub.ip, hub.port). Only called while
    // the Wi-Fi has an IP address.
    virtual void sendToHub(const char* text) = 0;
    // The serial console.
    virtual void printLine(const char* text) = 0;
};

// Everything between the Wi-Fi and the lights, as in tally/src/my-tally.lua
// and my-log.lua, without the hardware so it can be tested on a computer.
// Nothing here writes to flash: all state lives in RAM.
class TallyController {
public:
    // Same as v1: the Hub is lost 3 s after its last packet, and the tally
    // says "tally-ho" every second.
    static const uint32_t hubTimeoutMs = 3000;
    static const uint32_t helloIntervalMs = 1000;
    static const uint32_t logFlushIntervalMs = 50;
    // Version of the fields after the name in "tally-ho" (see README.md).
    static const uint8_t protocolVersion = 1;

    TallyController(const Settings& settings, const char* deviceId, LedEngine& leds, Platform& platform);

    void begin(uint32_t nowMs);

    // Wi-Fi events
    void wifiConnecting(uint32_t nowMs);
    void wifiAssociated(uint32_t nowMs);
    void wifiGotIp(uint32_t nowMs);
    void wifiLost(uint32_t nowMs);

    void packetReceived(const char* data, size_t length, uint32_t nowMs);
    void tick(uint32_t nowMs);

    void log(Severity severity, const char* message);
    bool isHubConnected(uint32_t nowMs) const;
    bool isWifiUp() const { return wifiUp; }

    // 'tally-ho "CAM1" gc/1 id=00a1b2c3 fw=2.0.0 hw=esp8266 caps=ws2812,pwm'
    void helloMessage(char* out, size_t size) const;

private:
    void sendHello();
    void sendLog(Severity severity, const char* message);

    const Settings& settings;
    const char* deviceId;
    LedEngine& leds;
    Platform& platform;
    LogBuffer buffer;

    bool wifiUp = false;
    bool hasPacket = false;
    uint32_t lastPacketMs = 0;
    uint32_t lastHelloMs = 0;
    uint32_t lastFlushMs = 0;
};

}  // namespace gctally
