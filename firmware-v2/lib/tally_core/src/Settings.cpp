#include "Settings.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

namespace gctally {

namespace {

const char* skipSpace(const char* text, const char* end) {
    while (text < end && isspace(static_cast<unsigned char>(*text))) text++;
    return text;
}

const char* trimEnd(const char* start, const char* end) {
    while (end > start && isspace(static_cast<unsigned char>(end[-1]))) end--;
    return end;
}

bool equals(const char* a, const char* b) { return strcmp(a, b) == 0; }

bool parseInteger(const char* text, long minimum, long maximum, long& out) {
    if (*text == '\0') return false;
    char* end;
    long value = strtol(text, &end, 10);
    if (*end != '\0' || value < minimum || value > maximum) return false;
    out = value;
    return true;
}

}  // namespace

bool isHubId(const char* text) {
    if (strlen(text) != 8) return false;
    for (const char* c = text; *c != '\0'; c++) {
        if (!isdigit(static_cast<unsigned char>(*c)) && (*c < 'a' || *c > 'f')) return false;
    }
    return true;
}

Settings::Settings(const char* defaultName) {
    setText(name, sizeof(name), defaultName, strlen(defaultName));
}

void Settings::setText(char* target, size_t size, const char* value, size_t length) {
    if (length >= size) length = size - 1;
    memcpy(target, value, length);
    target[length] = '\0';
}

void Settings::warn(const char* format, const char* a, const char* b) {
    if (warnings >= maxWarnings) return;
    snprintf(warningTexts[warnings], sizeof(warningTexts[warnings]), format, a, b);
    warnings++;
}

void Settings::parse(const char* text) {
    char line[160];
    while (*text != '\0') {
        const char* end = strchr(text, '\n');
        size_t length = end ? static_cast<size_t>(end - text) : strlen(text);
        setText(line, sizeof(line), text, length);
        parseLine(line);
        text += length;
        if (*text == '\n') text++;
    }
}

void Settings::parseLine(const char* line) {
    if (line[0] == ';') return;
    const char* lineEnd = line + strlen(line);
    const char* equalsSign = strchr(line, '=');
    if (equalsSign == nullptr) return;

    const char* keyStart = skipSpace(line, equalsSign);
    const char* keyEnd = trimEnd(keyStart, equalsSign);
    const char* valueStart = skipSpace(equalsSign + 1, lineEnd);
    const char* valueEnd = trimEnd(valueStart, lineEnd);
    if (keyStart == keyEnd || valueStart == valueEnd) return;

    char key[40];
    char value[100];
    setText(key, sizeof(key), keyStart, keyEnd - keyStart);
    setText(value, sizeof(value), valueStart, valueEnd - valueStart);

    if (equals(key, "station.ssid")) {
        if (strlen(value) >= sizeof(ssid)) warn("station.ssid is longer than %s characters", "32");
        setText(ssid, sizeof(ssid), value, strlen(value));
    } else if (equals(key, "station.password")) {
        if (strlen(value) >= sizeof(password)) warn("station.password is longer than %s characters", "64");
        setText(password, sizeof(password), value, strlen(value));
    } else if (equals(key, "hub.ip")) {
        setText(hubIp, sizeof(hubIp), value, strlen(value));
    } else if (equals(key, "hub.id")) {
        if (isHubId(value)) {
            setText(hubId, sizeof(hubId), value, strlen(value));
        } else {
            warn("hub.id needs the 8 characters (0-9, a-f) shown in the Hub, got \"%.20s\"", value);
        }
    } else if (equals(key, "hub.port")) {
        long port;
        if (parseInteger(value, 1, 65535, port)) {
            hubPort = static_cast<uint16_t>(port);
        } else {
            warn("Invalid hub.port \"%s\"", value);
        }
    } else if (equals(key, "tally.name")) {
        setText(name, sizeof(name), value, strlen(value));
    } else if (equals(key, "setup.password")) {
        // WPA2 needs 8 to 63 characters
        if (strlen(value) >= 8 && strlen(value) <= 63) {
            setText(setupKey, sizeof(setupKey), value, strlen(value));
        } else {
            warn("setup.password needs %s characters. It is ignored.", "8 to 63");
        }
    } else if (equals(key, "setup.recovery-after")) {
        long seconds;
        if (parseInteger(value, 0, 3600, seconds)) {
            recoveryAfter = static_cast<uint32_t>(seconds);
        } else {
            warn("setup.recovery-after needs seconds from 0 to 3600, but got \"%.30s\"", value);
        }
    } else if (equals(key, "operator.type")) {
        parseLightType(key, value, operatorType);
    } else if (equals(key, "operator.ws2812")) {
        parseWs2812(key, value, operatorWs2812Lights, operatorWs2812Order);
    } else if (equals(key, "stage.type")) {
        parseLightType(key, value, stageType);
    } else if (equals(key, "stage.ws2812")) {
        parseWs2812(key, value, stageWs2812Lights, stageWs2812Order);
    } else {
        warn("Unknown key %s in configuration file. Did you mistype it?", key);
    }
}

void Settings::parseLightType(const char* key, const char* value, LightType& out) {
    char lower[8];
    size_t length = strlen(value);
    if (length >= sizeof(lower)) length = sizeof(lower) - 1;
    for (size_t i = 0; i < length; i++) lower[i] = tolower(static_cast<unsigned char>(value[i]));
    lower[length] = '\0';

    if (strlen(value) < sizeof(lower) && equals(lower, "grb+")) {
        out = LightType::commonAnode;
    } else if (strlen(value) < sizeof(lower) && equals(lower, "grb-")) {
        out = LightType::commonCathode;
    } else {
        warn("Invalid %s \"%s\"", key, value);
    }
}

void Settings::parseWs2812(const char* key, const char* value, uint8_t& lights, Ws2812Order& order) {
    // "16" or "16 grb"
    char number[16];
    const char* space = strchr(value, ' ');
    size_t length = space ? static_cast<size_t>(space - value) : strlen(value);
    setText(number, sizeof(number), value, length);

    long count;
    if (parseInteger(number, 0, maxWs2812Lights, count)) {
        lights = static_cast<uint8_t>(count);
    } else {
        warn("%s needs to be number between 0 and 32, but got \"%s\"", key, value);
    }
    if (space != nullptr) {
        const char* type = space + 1;
        if (equals(type, "grb")) {
            order = Ws2812Order::grb;
        } else if (equals(type, "rgb")) {
            order = Ws2812Order::rgb;
        } else {
            warn("%s should have a supported light type, but got \"%s\"", key, type);
        }
    }
}

void Settings::hostName(char* out, size_t size) const {
    size_t written = snprintf(out, size, "Tally-");
    bool pendingDash = false;
    for (const char* c = name; *c != '\0' && written + 1 < size; c++) {
        if (isalnum(static_cast<unsigned char>(*c))) {
            if (pendingDash && written > strlen("Tally-") && written + 2 < size) out[written++] = '-';
            pendingDash = false;
            out[written++] = *c;
        } else {
            pendingDash = true;
        }
    }
    out[written] = '\0';
}

}  // namespace gctally
