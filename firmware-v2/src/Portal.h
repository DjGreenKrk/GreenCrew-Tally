#pragma once

#include <Arduino.h>

#include "Settings.h"
#include "SetupPage.h"
#include "WifiSupervisor.h"

// The setup access point: WPA2 with the setup password, a DNS server that
// answers every name with 192.168.4.1 (so phones open the page by
// themselves) and the setup page at http://192.168.4.1/.
//
// Two uses:
// - setup mode: the tally has no valid settings, or was asked for setup;
//   only the access point runs.
// - recovery: a configured tally lost its Wi-Fi for a while; the station keeps
//   trying in the background (WIFI_AP_STA) and the tally keeps working.
namespace Portal {

struct Info {
    const char* deviceId;
    const gctally::Settings* settings;
    bool recovery;
    gctally::WifiFailure trialFailure;
    const char* trialSsid;
};

void start(const char* apName, const char* password, const Info& info);
void stop();
bool isRunning();
void handle();

// After a save or a restart request, the tally should restart at this time.
bool restartRequested(uint32_t& atMs);
// Last time someone used the page.
uint32_t lastRequestMs();

}  // namespace Portal
