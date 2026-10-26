#pragma once

#include <stddef.h>
#include <stdint.h>

#include "SetupForm.h"
#include "WifiSupervisor.h"

namespace gctally {

enum class Language : uint8_t { en, pl };

// "pl" when the browser prefers Polish (Accept-Language), else English.
Language pickLanguage(const char* acceptLanguage);

// Where the page goes, piece by piece (the ESP8266 sends it in chunks).
class TextSink {
public:
    virtual ~TextSink() {}
    virtual void write(const char* text) = 0;
};

void writeEscaped(TextSink& sink, const char* text);

struct ScannedNetwork {
    const char* ssid;
    int8_t rssi;
    bool secure;
};

struct SetupPageModel {
    Language language = Language::en;
    const char* deviceId = "";
    const char* firmware = "";
    // true: the recovery access point of a configured tally
    bool recovery = false;

    // The fields as stored, or as sent when the form had an error.
    // The password itself is never put on the page.
    const char* ssid = "";
    bool hasPassword = false;
    const char* name = "";
    const char* hubIp = "";
    const char* hubPort = "7411";

    const ScannedNetwork* networks = nullptr;
    size_t networkCount = 0;

    FormError error = FormError::none;
    // The last saved configuration that did not connect, if any
    WifiFailure trialFailure = WifiFailure::none;
    const char* trialSsid = "";
};

void renderSetupPage(const SetupPageModel& model, TextSink& sink);
// After saving: the tally restarts and tries the new network.
void renderSavedPage(Language language, const char* ssid, TextSink& sink);

}  // namespace gctally
