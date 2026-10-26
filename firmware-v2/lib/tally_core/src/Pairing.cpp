#include "Pairing.h"

#include <stdio.h>
#include <string.h>

#include "Settings.h"
#include "Sha256.h"

namespace gctally {

namespace {

const size_t maxFields = 6;
const size_t maxLine = 320;

struct Field {
    const char* key;
    const char* value;
};

// "gc/1 <verb> key=value ..." split in place
struct Message {
    char line[maxLine + 1];
    const char* verb = "";
    Field fields[maxFields];
    size_t fieldCount = 0;
    // length of the line before " mac=", what the mac covers
    size_t signedLength = 0;

    bool parse(const char* data, size_t length) {
        while (length > 0 && (data[length - 1] == '\n' || data[length - 1] == '\r' || data[length - 1] == ' ')) length--;
        if (length > maxLine) return false;
        memcpy(line, data, length);
        line[length] = '\0';
        const char* mac = strstr(line, " mac=");
        signedLength = mac != nullptr ? static_cast<size_t>(mac - line) : length;

        char* rest = nullptr;
        char* word = strtok_r(line, " ", &rest);
        if (word == nullptr || strcmp(word, "gc/1") != 0) return false;
        word = strtok_r(nullptr, " ", &rest);
        if (word == nullptr) return false;
        verb = word;
        while ((word = strtok_r(nullptr, " ", &rest)) != nullptr) {
            char* equals = strchr(word, '=');
            if (equals == nullptr || fieldCount == maxFields) return false;
            *equals = '\0';
            fields[fieldCount++] = {word, equals + 1};
        }
        return true;
    }

    const char* get(const char* key) const {
        for (size_t i = 0; i < fieldCount; i++) {
            if (strcmp(fields[i].key, key) == 0) return fields[i].value;
        }
        return "";
    }
};

int hexValue(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

// Constant time, so the time to answer tells nothing about the mac
bool sameBytes(const uint8_t* a, const uint8_t* b, size_t length) {
    uint8_t difference = 0;
    for (size_t i = 0; i < length; i++) difference |= a[i] ^ b[i];
    return difference == 0;
}

void crewKeyStream(const uint8_t* token, const char* challenge, uint8_t* out, size_t length) {
    for (size_t block = 0; block * Sha256::digestSize < length; block++) {
        char label[48];
        snprintf(label, sizeof(label), "crew-password %s %u", challenge, static_cast<unsigned>(block));
        uint8_t stream[Sha256::digestSize];
        hmacSha256(token, Pairing::tokenSize, label, strlen(label), stream);
        for (size_t i = 0; i < Sha256::digestSize && block * Sha256::digestSize + i < length; i++) {
            out[block * Sha256::digestSize + i] = stream[i];
        }
    }
}

}  // namespace

void toHex(const uint8_t* bytes, size_t length, char* out) {
    const char* digits = "0123456789abcdef";
    for (size_t i = 0; i < length; i++) {
        out[2 * i] = digits[bytes[i] >> 4];
        out[2 * i + 1] = digits[bytes[i] & 15];
    }
    out[2 * length] = '\0';
}

bool fromHex(const char* text, uint8_t* bytes, size_t length) {
    if (strlen(text) != 2 * length) return false;
    for (size_t i = 0; i < length; i++) {
        int high = hexValue(text[2 * i]);
        int low = hexValue(text[2 * i + 1]);
        if (high < 0 || low < 0) return false;
        bytes[i] = static_cast<uint8_t>(high << 4 | low);
    }
    return true;
}

bool Pairing::parse(const char* text) {
    *this = Pairing();
    char hub[16] = "";
    char tokenText[40] = "";
    if (sscanf(text, "hub=%15s token=%39s", hub, tokenText) != 2) return false;
    if (!isHubId(hub) || !fromHex(tokenText, token, tokenSize)) {
        *this = Pairing();
        return false;
    }
    strcpy(hubId, hub);
    paired = true;
    return true;
}

void Pairing::write(char* out, size_t size) const {
    char tokenText[2 * tokenSize + 1];
    toHex(token, tokenSize, tokenText);
    snprintf(out, size, "hub=%s\ntoken=%s\n", hubId, tokenText);
}

PairingController::PairingController(const char* deviceId, uint32_t (*random)()) : deviceId(deviceId), random(random) {}

void PairingController::begin(const Pairing& stored, const char* crewPassword) {
    current = stored;
    crew[0] = '\0';
    if (current.paired && isSetupPassword(crewPassword)) strcpy(crew, crewPassword);
    newChallenge();
}

void PairingController::newChallenge() {
    unsigned high = random();
    unsigned low = random();
    snprintf(challengeText, sizeof(challengeText), "%08x%08x", high, low);
}

bool PairingController::isManagementMessage(const char* data, size_t length) { return length >= 3 && strncmp(data, "gc/", 3) == 0; }

void PairingController::refuse(Result& result, const char* verb, const char* why) const {
    snprintf(result.reply, sizeof(result.reply), "gc/1 refused id=%s to=%.16s why=%s\n", deviceId, verb, why);
}

PairingController::Result PairingController::handle(const char* data, size_t length) {
    Result result;
    Message message;
    if (!message.parse(data, length)) {
        refuse(result, "?", "format");
        return result;
    }
    const char* verb = message.verb;
    const char* hub = message.get("hub");
    if (!isHubId(hub)) {
        refuse(result, verb, "format");
        return result;
    }

    if (strcmp(verb, "identify") == 0) {
        result.effect = Effect::identify;
        return result;
    }

    if (strcmp(verb, "pair") == 0) {
        if (current.paired) {
            // Unpairing first, by the paired Hub or on the setup page,
            // keeps another Hub from taking the tally over.
            refuse(result, verb, strcmp(current.hubId, hub) == 0 ? "already-paired" : "paired-elsewhere");
            return result;
        }
        Pairing next;
        if (!fromHex(message.get("token"), next.token, Pairing::tokenSize)) {
            refuse(result, verb, "format");
            return result;
        }
        strcpy(next.hubId, hub);
        next.paired = true;
        current = next;
        crew[0] = '\0';
        newChallenge();
        result.effect = Effect::savePairing;
        snprintf(result.reply, sizeof(result.reply), "gc/1 paired id=%s hub=%s\n", deviceId, hub);
        return result;
    }

    bool unpair = strcmp(verb, "unpair") == 0;
    bool crewPassword = strcmp(verb, "crew-password") == 0;
    if (!unpair && !crewPassword) {
        refuse(result, verb, "unknown");
        return result;
    }

    // From here on only the paired Hub, with a fresh challenge and the mac
    if (!current.paired || strcmp(current.hubId, hub) != 0) {
        refuse(result, verb, "not-paired");
        return result;
    }
    if (strcmp(message.get("ch"), challengeText) != 0) {
        refuse(result, verb, "challenge");
        return result;
    }
    uint8_t mac[Sha256::digestSize];
    uint8_t expected[Sha256::digestSize];
    if (!fromHex(message.get("mac"), mac, sizeof(mac))) {
        refuse(result, verb, "mac");
        return result;
    }
    // the mac covers the line as sent, before it was split
    char line[maxLine + 1];
    memcpy(line, data, message.signedLength);
    hmacSha256(current.token, Pairing::tokenSize, line, message.signedLength, expected);
    if (!sameBytes(mac, expected, sizeof(mac))) {
        refuse(result, verb, "mac");
        return result;
    }

    if (unpair) {
        snprintf(result.reply, sizeof(result.reply), "gc/1 unpaired id=%s hub=%s\n", deviceId, hub);
        current = Pairing();
        crew[0] = '\0';
        newChallenge();
        result.effect = Effect::removePairing;
        return result;
    }

    const char* pw = message.get("pw");
    size_t passwordLength = strlen(pw) / 2;
    uint8_t password[maxCrewPassword + 1];
    if (passwordLength > maxCrewPassword || !fromHex(pw, password, passwordLength)) {
        refuse(result, verb, "format");
        return result;
    }
    uint8_t stream[2 * Sha256::digestSize];
    crewKeyStream(current.token, challengeText, stream, passwordLength);
    for (size_t i = 0; i < passwordLength; i++) password[i] ^= stream[i];
    password[passwordLength] = '\0';
    const char* text = reinterpret_cast<const char*>(password);
    if (passwordLength > 0 && !isSetupPassword(text)) {
        refuse(result, verb, "password");
        newChallenge();
        return result;
    }
    strcpy(crew, text);
    newChallenge();
    result.effect = Effect::saveCrewPassword;
    snprintf(result.reply, sizeof(result.reply), "gc/1 crew-password-set id=%s hub=%s\n", deviceId, hub);
    return result;
}

}  // namespace gctally
