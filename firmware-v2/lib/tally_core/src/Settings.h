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

    bool isValid() const { return ssid[0] != '\0' && hubIp[0] != '\0'; }

    const char* stationSsid() const { return ssid; }
    const char* stationPassword() const { return password; }
    const char* hubAddress() const { return hubIp; }
    uint16_t hubUdpPort() const { return hubPort; }
    const char* tallyName() const { return name; }
    // "Tally-" and the name with every run of non-alphanumerics as one "-"
    void hostName(char* out, size_t size) const;

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
    uint16_t hubPort = 7411;
    char name[maxNameLength + 1] = "";

    char warningTexts[maxWarnings][96];
    size_t warnings = 0;
};

}  // namespace gctally
