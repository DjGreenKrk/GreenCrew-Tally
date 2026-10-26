#pragma once

#include <Arduino.h>

// The settings files on LittleFS. Flash is written only when someone saves
// the setup page and when that new configuration has proven to work:
//
//   /tally-settings.ini    the committed configuration
//   /tally-settings.new    saved on the setup page, not tried yet
//   /tally-settings.trial  being tried since this boot
//   /setup-key             generated password of the setup access point
//   /pairing               the paired Hub and its token (#28)
//   /hub-crew-password     the crew password the paired Hub set (#28)
//
// Every write goes to a temporary file first and is then renamed, which
// LittleFS does atomically, so a power loss leaves the old or the new file,
// never half of one. A power loss during a trial counts as a failed trial.
namespace ConfigStore {

enum class Boot {
    committed,           // normal boot
    trial,               // trying /tally-settings.trial
    interruptedTrial,    // the last trial did not finish; read it for the
                         // error message, then dropTrial()
};

bool begin();
// Moves a saved configuration to trial; call once at boot.
Boot prepare();
// The committed settings file, or the trial file for Boot::trial and
// Boot::interruptedTrial; empty when there is none.
String readSettings(Boot boot);
String readCommitted();
// Keeps the configuration on trial as the committed one.
bool commitTrial();
void dropTrial();
// Stores a configuration from the setup page for the next boot.
bool saveForTrial(const String& text);
// The setup password: read from /setup-key, or generated and stored there
// the first time.
String setupKey();

// Pairing (#28): written only when the tally is paired or unpaired, or the
// Hub changes the crew password.
String readPairing();
bool writePairing(const String& text);
// Removes the pairing and the crew password that came with it.
void removePairing();
String readHubCrewPassword();
// An empty password removes the file.
bool writeHubCrewPassword(const String& password);

}  // namespace ConfigStore
