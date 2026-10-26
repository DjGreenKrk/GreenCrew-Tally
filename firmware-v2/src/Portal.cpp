#include "Portal.h"

#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>

#include "ConfigStore.h"
#include "SetupForm.h"

using namespace gctally;

namespace {

const IPAddress apAddress(192, 168, 4, 1);
const size_t maxNetworks = 12;

struct Network {
    char ssid[33];
    int8_t rssi;
    bool secure;
};

DNSServer* dns;
ESP8266WebServer* server;
Portal::Info info;
Network networks[maxNetworks];
size_t networkCount = 0;
bool restarting = false;
uint32_t restartAtMs = 0;
uint32_t lastRequest = 0;

// Sends the page in chunks of about 512 bytes.
class ChunkSink : public TextSink {
public:
    void write(const char* text) override {
        size_t length = strlen(text);
        if (used + length >= sizeof(buffer)) flush();
        if (length >= sizeof(buffer)) {
            server->sendContent(text, length);
            return;
        }
        memcpy(buffer + used, text, length);
        used += length;
    }
    void flush() {
        if (used > 0) server->sendContent(buffer, used);
        used = 0;
    }

private:
    char buffer[512];
    size_t used = 0;
};

// Strongest first, each name once, no hidden networks.
void scan() {
    networkCount = 0;
    int found = WiFi.scanNetworks();
    for (int i = 0; i < found; i++) {
        String ssid = WiFi.SSID(i);
        if (ssid.length() == 0 || ssid.length() > 32) continue;
        int8_t rssi = WiFi.RSSI(i);
        size_t index = 0;
        while (index < networkCount && strcmp(networks[index].ssid, ssid.c_str()) != 0) index++;
        if (index < networkCount) {
            if (rssi > networks[index].rssi) networks[index].rssi = rssi;
            continue;
        }
        if (networkCount == maxNetworks) continue;
        Network& network = networks[networkCount++];
        strncpy(network.ssid, ssid.c_str(), sizeof(network.ssid));
        network.ssid[sizeof(network.ssid) - 1] = '\0';
        network.rssi = rssi;
        network.secure = WiFi.encryptionType(i) != ENC_TYPE_NONE;
    }
    WiFi.scanDelete();
    for (size_t i = 1; i < networkCount; i++) {
        for (size_t j = i; j > 0 && networks[j].rssi > networks[j - 1].rssi; j--) {
            Network swap = networks[j];
            networks[j] = networks[j - 1];
            networks[j - 1] = swap;
        }
    }
}

// The page is only for devices on the setup access point, never for the
// show network the station is on.
bool fromAccessPoint() {
    if (server->client().localIP() == apAddress) return true;
    server->send(403, "text/plain", "Forbidden");
    return false;
}

Language language() { return pickLanguage(server->header("Accept-Language").c_str()); }

void startPage() {
    server->setContentLength(CONTENT_LENGTH_UNKNOWN);
    server->sendHeader("Cache-Control", "no-store");
    server->send(200, "text/html; charset=utf-8", "");
}

void endPage(ChunkSink& sink) {
    sink.flush();
    server->sendContent("");
}

void sendSetupPage(const SetupForm* typed, FormError error) {
    ScannedNetwork scanned[maxNetworks];
    for (size_t i = 0; i < networkCount; i++) scanned[i] = {networks[i].ssid, networks[i].rssi, networks[i].secure};

    char port[6];
    snprintf(port, sizeof(port), "%u", info.settings->hubUdpPort());
    SetupPageModel model;
    model.language = language();
    model.deviceId = info.deviceId;
    model.firmware = GC_FIRMWARE_VERSION;
    model.recovery = info.recovery;
    model.ssid = typed ? typed->ssid : info.settings->stationSsid();
    model.hasPassword = info.settings->stationPassword()[0] != '\0';
    model.name = typed ? typed->name : info.settings->tallyName();
    model.hubIp = typed ? typed->hubIp : info.settings->hubAddress();
    model.hubPort = typed ? typed->hubPort : port;
    model.hubId = typed ? typed->hubId : info.settings->pinnedHubId();
    model.networks = scanned;
    model.networkCount = networkCount;
    model.error = error;
    model.trialFailure = info.trialFailure;
    model.trialSsid = info.trialSsid;
    model.pairedHubId = info.pairedHubId;

    startPage();
    ChunkSink sink;
    renderSetupPage(model, sink);
    endPage(sink);
}

void handleRoot() {
    if (!fromAccessPoint()) return;
    lastRequest = millis();
    if (server->hasArg("scan")) scan();
    sendSetupPage(nullptr, FormError::none);
}

void handleSave() {
    if (!fromAccessPoint()) return;
    lastRequest = millis();
    String ssid = server->arg("ssid");
    String password = server->arg("password");
    String name = server->arg("name");
    String hub = server->arg("hub");
    String port = server->arg("port");
    String hubId = server->arg("hubid");
    SetupForm form;
    form.ssid = ssid.c_str();
    form.password = password.c_str();
    form.openNetwork = server->arg("open") == "1";
    form.name = name.c_str();
    form.hubIp = hub.c_str();
    form.hubPort = port.c_str();
    form.hubId = hubId.c_str();

    FormError error = validateSetupForm(form);
    if (error != FormError::none) {
        sendSetupPage(&form, error);
        return;
    }

    String original = ConfigStore::readCommitted();
    size_t size = original.length() + 512;
    char* text = new char[size];
    bool ok = applySetupForm(original.c_str(), form, text, size) && ConfigStore::saveForTrial(String(text));
    delete[] text;
    if (!ok) {
        server->send(500, "text/plain", "Could not save the settings");
        return;
    }
    Serial.printf("[INFO]  Saved new settings for %s, restarting to try them\n", form.ssid);

    startPage();
    ChunkSink sink;
    renderSavedPage(language(), form.ssid, sink);
    endPage(sink);
    restarting = true;
    restartAtMs = millis() + 1500;  // let the page reach the phone
}

void handleRestart() {
    if (!fromAccessPoint()) return;
    server->send(200, "text/plain; charset=utf-8", "Restarting");
    restarting = true;
    restartAtMs = millis() + 500;
}

// For a tally whose Hub is gone; the Hub can unpair it too.
void handleUnpair() {
    if (!fromAccessPoint()) return;
    ConfigStore::removePairing();
    Serial.println("[INFO]  Unpaired on the setup page");
    server->send(200, "text/plain; charset=utf-8", "Unpaired. Restarting.");
    restarting = true;
    restartAtMs = millis() + 500;
}

// Captive portal: whatever the phone asks for (generate_204,
// hotspot-detect.html, connecttest.txt, ...) is sent to the setup page.
void handleOther() {
    server->sendHeader("Location", "http://192.168.4.1/");
    server->send(302, "text/plain", "");
}

}  // namespace

namespace Portal {

void start(const char* apName, const char* password, const Info& portalInfo) {
    if (server != nullptr) return;
    info = portalInfo;
    // Scan before the access point starts: scanning moves the radio
    // between channels.
    WiFi.mode(info.recovery ? WIFI_AP_STA : WIFI_STA);
    scan();
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAPConfig(apAddress, apAddress, IPAddress(255, 255, 255, 0));
    WiFi.softAP(apName, password, 1, false, 4);

    dns = new DNSServer();
    dns->setErrorReplyCode(DNSReplyCode::NoError);
    dns->start(53, "*", apAddress);

    server = new ESP8266WebServer(80);
    server->collectHeaders("Accept-Language");
    server->on("/", HTTP_GET, handleRoot);
    server->on("/save", HTTP_POST, handleSave);
    server->on("/restart", HTTP_POST, handleRestart);
    server->on("/unpair", HTTP_POST, handleUnpair);
    server->onNotFound(handleOther);
    server->begin();
    lastRequest = millis();
}

void stop() {
    if (server == nullptr) return;
    server->stop();
    delete server;
    server = nullptr;
    dns->stop();
    delete dns;
    dns = nullptr;
    WiFi.softAPdisconnect(true);
}

bool isRunning() { return server != nullptr; }

void handle() {
    if (server == nullptr) return;
    dns->processNextRequest();
    server->handleClient();
}

bool restartRequested(uint32_t& atMs) {
    atMs = restartAtMs;
    return restarting;
}

uint32_t lastRequestMs() { return lastRequest; }

}  // namespace Portal
