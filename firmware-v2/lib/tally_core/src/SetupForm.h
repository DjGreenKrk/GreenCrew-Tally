#pragma once

#include <stddef.h>

namespace gctally {

// What the setup page sends. Empty strings for empty fields.
struct SetupForm {
    const char* ssid = "";
    // Empty: keep the stored password, unless openNetwork is set.
    const char* password = "";
    bool openNetwork = false;
    const char* name = "";
    const char* hubIp = "";
    const char* hubPort = "";
};

enum class FormError {
    none,
    ssidMissing,
    ssidInvalid,     // longer than 32 bytes, control characters or spaces around it
    passwordLength,  // WPA2 needs 8 to 63 characters (or 64 hex digits)
    passwordInvalid,
    nameMissing,
    nameInvalid,     // longer than 26 characters, '"' or control characters
    hubIpMissing,
    hubIpInvalid,
    hubPortInvalid,
};

FormError validateSetupForm(const SetupForm& form);

// One key of tally-settings.ini to set (value) or to remove (value nullptr).
struct IniChange {
    const char* key;
    const char* value;
};

// Writes `original` with the changes to `out`: the first line of a key gets
// the new value, later lines of the same key go away, missing keys are added
// at the end. Comments and all other lines stay as they are. False when
// `out` is too small.
bool updateIni(const char* original, const IniChange* changes, size_t count, char* out, size_t size);

// The settings file after saving a valid form.
bool applySetupForm(const char* original, const SetupForm& form, char* out, size_t size);

}  // namespace gctally
