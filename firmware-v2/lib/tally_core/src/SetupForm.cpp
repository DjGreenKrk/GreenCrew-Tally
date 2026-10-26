#include "SetupForm.h"

#include <ctype.h>
#include <stdlib.h>
#include <string.h>

#include "Settings.h"

namespace gctally {

namespace {

bool hasControlCharacters(const char* text) {
    for (const char* c = text; *c != '\0'; c++) {
        unsigned char byte = static_cast<unsigned char>(*c);
        if (byte < 0x20 || byte == 0x7f) return true;
    }
    return false;
}

// Settings trims values, so spaces at the ends would get lost.
bool hasSpaceAround(const char* text) {
    size_t length = strlen(text);
    return length > 0 && (isspace(static_cast<unsigned char>(text[0])) || isspace(static_cast<unsigned char>(text[length - 1])));
}

bool isHex(const char* text) {
    for (const char* c = text; *c != '\0'; c++) {
        if (!isxdigit(static_cast<unsigned char>(*c))) return false;
    }
    return true;
}

bool isHostName(const char* text) {
    if (strlen(text) > 63) return false;
    for (const char* c = text; *c != '\0'; c++) {
        if (!isalnum(static_cast<unsigned char>(*c)) && *c != '.' && *c != '-') return false;
    }
    return true;
}

class Writer {
public:
    Writer(char* out, size_t size) : out(out), size(size) {
        if (size > 0) out[0] = '\0';
    }
    void append(const char* text, size_t length) {
        if (size == 0 || length >= size - written) {
            overflow = true;
            return;
        }
        memcpy(out + written, text, length);
        written += length;
        out[written] = '\0';
    }
    void append(const char* text) { append(text, strlen(text)); }
    void appendSetting(const char* key, const char* value) {
        append(key);
        append("=");
        append(value);
        append("\n");
    }
    bool endsWithNewline() const { return written == 0 || out[written - 1] == '\n'; }
    bool ok() const { return !overflow; }

private:
    char* out;
    size_t size;
    size_t written = 0;
    bool overflow = false;
};

// The key of a settings line, as Settings reads it; false for comments and
// lines without "=".
bool lineKey(const char* line, size_t length, const char*& key, size_t& keyLength) {
    if (length == 0 || line[0] == ';') return false;
    const char* equalsSign = static_cast<const char*>(memchr(line, '=', length));
    if (equalsSign == nullptr) return false;
    const char* start = line;
    while (start < equalsSign && isspace(static_cast<unsigned char>(*start))) start++;
    const char* end = equalsSign;
    while (end > start && isspace(static_cast<unsigned char>(end[-1]))) end--;
    key = start;
    keyLength = end - start;
    return keyLength > 0;
}

}  // namespace

FormError validateSetupForm(const SetupForm& form) {
    if (form.ssid[0] == '\0') return FormError::ssidMissing;
    if (strlen(form.ssid) > 32 || hasControlCharacters(form.ssid) || hasSpaceAround(form.ssid)) return FormError::ssidInvalid;

    if (form.password[0] != '\0') {
        size_t length = strlen(form.password);
        if (length < 8 || length > 64 || (length == 64 && !isHex(form.password))) return FormError::passwordLength;
        if (hasControlCharacters(form.password) || hasSpaceAround(form.password)) return FormError::passwordInvalid;
    }

    if (form.name[0] == '\0') return FormError::nameMissing;
    if (strlen(form.name) > Settings::maxNameLength || strchr(form.name, '"') != nullptr || hasControlCharacters(form.name) ||
        hasSpaceAround(form.name)) {
        return FormError::nameInvalid;
    }

    if (!isHostName(form.hubIp)) return FormError::hubIpInvalid;

    if (form.hubPort[0] != '\0') {
        char* end;
        long port = strtol(form.hubPort, &end, 10);
        if (*end != '\0' || port < 1 || port > 65535) return FormError::hubPortInvalid;
    }
    if (form.hubId[0] != '\0' && !isHubId(form.hubId)) return FormError::hubIdInvalid;
    return FormError::none;
}

bool updateIni(const char* original, const IniChange* changes, size_t count, char* out, size_t size) {
    const size_t maxChanges = 16;
    if (count > maxChanges) return false;
    bool done[maxChanges] = {};
    Writer writer(out, size);

    const char* line = original;
    while (*line != '\0') {
        const char* newline = strchr(line, '\n');
        size_t length = newline ? static_cast<size_t>(newline - line) + 1 : strlen(line);

        const char* key;
        size_t keyLength;
        bool replaced = false;
        if (lineKey(line, length, key, keyLength)) {
            for (size_t i = 0; i < count; i++) {
                if (strlen(changes[i].key) != keyLength || strncmp(changes[i].key, key, keyLength) != 0) continue;
                if (!done[i] && changes[i].value != nullptr) writer.appendSetting(changes[i].key, changes[i].value);
                done[i] = true;
                replaced = true;
                break;
            }
        }
        if (!replaced) writer.append(line, length);
        line += length;
    }

    for (size_t i = 0; i < count; i++) {
        if (done[i] || changes[i].value == nullptr) continue;
        if (!writer.endsWithNewline()) writer.append("\n");
        writer.appendSetting(changes[i].key, changes[i].value);
    }
    return writer.ok();
}

bool applySetupForm(const char* original, const SetupForm& form, char* out, size_t size) {
    IniChange changes[6];
    size_t count = 0;
    changes[count++] = {"station.ssid", form.ssid};
    if (form.password[0] != '\0') {
        changes[count++] = {"station.password", form.password};
    } else if (form.openNetwork) {
        changes[count++] = {"station.password", nullptr};
    }
    changes[count++] = {"tally.name", form.name};
    changes[count++] = {"hub.ip", form.hubIp[0] != '\0' ? form.hubIp : nullptr};
    changes[count++] = {"hub.id", form.hubId[0] != '\0' ? form.hubId : nullptr};
    changes[count++] = {"hub.port", form.hubPort[0] != '\0' ? form.hubPort : "7411"};
    return updateIni(original, changes, count, out, size);
}

}  // namespace gctally
