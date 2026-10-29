#include "ConfigStore.h"

#include <LittleFS.h>

namespace {

const char* committedPath = "/tally-settings.ini";
const char* newPath = "/tally-settings.new";
const char* trialPath = "/tally-settings.trial";
const char* keyPath = "/setup-key";
const char* pairingPath = "/pairing";
const char* hubCrewPasswordPath = "/hub-crew-password";
const char* temporaryPath = "/write.tmp";

String readFile(const char* path) {
    File file = LittleFS.open(path, "r");
    if (!file) return String();
    String text = file.readString();
    file.close();
    return text;
}

bool writeFile(const char* path, const String& text) {
    File file = LittleFS.open(temporaryPath, "w");
    if (!file) return false;
    size_t written = file.print(text);
    file.close();
    if (written != text.length()) {
        LittleFS.remove(temporaryPath);
        return false;
    }
    return LittleFS.rename(temporaryPath, path);
}

}  // namespace

namespace ConfigStore {

bool begin() { return LittleFS.begin(); }

Boot prepare() {
    if (LittleFS.exists(trialPath)) return Boot::interruptedTrial;
    if (LittleFS.exists(newPath) && LittleFS.rename(newPath, trialPath)) return Boot::trial;
    return Boot::committed;
}

String readSettings(Boot boot) { return readFile(boot == Boot::committed ? committedPath : trialPath); }

String readCommitted() { return readFile(committedPath); }

bool commitTrial() { return LittleFS.rename(trialPath, committedPath); }

void dropTrial() { LittleFS.remove(trialPath); }

bool saveForTrial(const String& text) { return writeFile(newPath, text); }

String setupKey() {
    String key = readFile(keyPath);
    key.trim();
    if (key.length() >= 8) return key;

    // Letters and digits that cannot be mixed up when typed from the log
    const char* alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
    key = "";
    for (int i = 0; i < 10; i++) key += alphabet[ESP.random() % strlen(alphabet)];
    if (!writeFile(keyPath, key)) Serial.println("[ERROR] Could not store the setup password");
    return key;
}

String readPairing() { return readFile(pairingPath); }

bool writePairing(const String& text) { return writeFile(pairingPath, text); }

bool removePairing() {
    // the crew password first: it is used only while paired
    if (LittleFS.exists(hubCrewPasswordPath) && !LittleFS.remove(hubCrewPasswordPath)) return false;
    return !LittleFS.exists(pairingPath) || LittleFS.remove(pairingPath);
}

String readHubCrewPassword() { return readFile(hubCrewPasswordPath); }

bool writeHubCrewPassword(const String& password) {
    if (password.length() == 0) return !LittleFS.exists(hubCrewPasswordPath) || LittleFS.remove(hubCrewPasswordPath);
    return writeFile(hubCrewPasswordPath, password);
}

}  // namespace ConfigStore
