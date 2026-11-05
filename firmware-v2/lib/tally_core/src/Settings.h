#pragma once

#include <stddef.h>
#include <stdint.h>

namespace gctally {

enum class LightType : uint8_t {
    commonAnode,    // "grb+": the LED lights when the pin is LOW
    commonCathode,  // "grb-": the LED lights when the pin is HIGH
};

enum class Ws2812Order : uint8_t {
    grb,
    rgb,
};

// How the tally reaches the Hub. wifi (default): the existing Wi-Fi/UDP
// station mode. espNow: no Wi-Fi network at all, receiving and sending
// through a USB gateway over ESP-NOW (#25); see GatewayLink.h.
enum class TransportMode : uint8_t {
    wifi,
    espNow,
};

// The id the Hub announces (8 lowercase hex digits)
bool isHubId(const char* text);

// A WPA2 passphrase: 8 to 63 printable ASCII characters.
bool isSetupPassword(const char* text);

enum class SetupPasswordSource : uint8_t { settings, crew, generated };

// Which password the setup access point uses: setup.password from the
// settings file, else the crew password built into the firmware
// (GC_SETUP_PASSWORD at build time), else one the tally generates.
SetupPasswordSource pickSetupPassword(const char* fromSettings, const char* crew);

// The keys of tally-settings.ini, read the same way as tally/src/my-settings.lua.
// One difference: a value may contain "=", so Wi-Fi passwords with "=" work.
class Settings {
public:
    static const size_t maxNameLength = 26;
    static const uint8_t maxWs2812Lights = 32;
    static const size_t maxWarnings = 8;

    // defaultName: the chip id in hex, used when tally.name is missing
    explicit Settings(const char* defaultName);

    // Reads one line; call it for every line of the file.
    void parseLine(const char* line);
    void parse(const char* text);

    // hub.ip may be empty: the tally then looks for the Hub over mDNS.
    // An ESP-NOW tally needs no Wi-Fi network, so it is valid without a ssid.
    bool isValid() const { return ssid[0] != '\0' || transport == TransportMode::espNow; }

    const char* stationSsid() const { return ssid; }
    const char* stationPassword() const { return password; }
    const char* hubAddress() const { return hubIp; }
    bool hasHubAddress() const { return hubIp[0] != '\0'; }
    // hub.id: only this Hub is used when the tally looks for one; empty: any
    // single Hub on the network.
    const char* pinnedHubId() const { return hubId; }
    uint16_t hubUdpPort() const { return hubPort; }
    const char* tallyName() const { return name; }
    // Password of the setup and recovery access point (setup.password),
    // empty when not set.
    const char* setupPassword() const { return setupKey; }
    // How long without Wi-Fi before the recovery access point starts
    // (setup.recovery-after, seconds); 0 turns it off.
    uint32_t recoveryAfterMs() const { return recoveryAfter * 1000; }
    // "Tally-" and the name with every run of non-alphanumerics as one "-"
    void hostName(char* out, size_t size) const;

    // transport.mode: "wifi" (default) or "espnow" (#25).
    TransportMode transportMode() const { return transport; }
    // transport.channel: the fixed Wi-Fi channel the gateway and its tallies
    // share for ESP-NOW (1-13, default 1). Unused in wifi mode.
    uint8_t espNowChannel() const { return channel; }

    LightType operatorType = LightType::commonAnode;
    Ws2812Order operatorWs2812Order = Ws2812Order::grb;
    uint8_t operatorWs2812Lights = 5;
    LightType stageType = LightType::commonAnode;
    Ws2812Order stageWs2812Order = Ws2812Order::grb;
    uint8_t stageWs2812Lights = 0;

    // Problems found while parsing, to be logged once the log is ready.
    size_t warningCount() const { return warnings; }
    const char* warning(size_t index) const { return warningTexts[index]; }

private:
    void setText(char* target, size_t size, const char* value, size_t length);
    void parseLightType(const char* key, const char* value, LightType& out);
    void parseWs2812(const char* key, const char* value, uint8_t& lights, Ws2812Order& order);
    void warn(const char* format, const char* a, const char* b = "");

    char ssid[33] = "";
    char password[65] = "";
    char hubIp[64] = "";
    char hubId[9] = "";
    uint16_t hubPort = 7411;
    char name[maxNameLength + 1] = "";
    char setupKey[64] = "";
    uint32_t recoveryAfter = 30;
    TransportMode transport = TransportMode::wifi;
    uint8_t channel = 1;

    char warningTexts[maxWarnings][96];
    size_t warnings = 0;
};

}  // namespace gctally
