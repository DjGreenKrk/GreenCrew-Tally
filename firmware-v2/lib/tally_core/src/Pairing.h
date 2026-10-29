#pragma once

#include <stddef.h>
#include <stdint.h>

namespace gctally {

// Pairing with one Hub (#28): the Hub's ID and a secret token the Hub chose
// when the operator paired the tally. Kept in /pairing, written only when
// the tally is paired or unpaired.
struct Pairing {
    static const size_t tokenSize = 16;

    bool paired = false;
    char hubId[9] = "";
    uint8_t token[tokenSize] = {};

    // "hub=<id>\ntoken=<32 hex>\n"; false (and unpaired) for anything else
    bool parse(const char* text);
    void write(char* out, size_t size) const;
};

// Management messages, one line each on the tally's UDP port, separate
// from the state packets (see README.md, Pairing):
//
//   gc/1 identify hub=<id>                          blink white for 10 s
//   gc/1 pair hub=<id> token=<32 hex>               only when unpaired, or
//                                                   the same pairing again
//   gc/1 unpair hub=<id> ch=<challenge> mac=<hmac>
//   gc/1 crew-password hub=<id> ch=<challenge> pw=<hex> mac=<hmac>
//
// mac is HMAC-SHA256 with the token over the line before " mac=", as 64 hex.
// ch is the challenge the tally sends in "tally-ho"; it changes after every
// accepted message, so a recorded message cannot be sent again. pw is the
// crew password XOR HMAC-SHA256(token, "crew-password <ch> <block>") for
// blocks 0 and 1, as hex; empty clears it. The answer names the password
// the tally took, so the Hub cannot mistake it for a newer one it sent.
//
// The tally answers to the sender:
//   gc/1 paired id=<device> hub=<id>
//   gc/1 unpaired id=<device> hub=<id>
//   gc/1 crew-password-set id=<device> hub=<id> crew=<fingerprint>
//   gc/1 refused id=<device> to=<verb> why=<reason>
class PairingController {
public:
    static const size_t maxCrewPassword = 63;
    static const uint32_t identifyMs = 10000;

    enum class Effect : uint8_t {
        none,
        identify,
        savePairing,       // write pairing() to flash
        removePairing,     // remove the pairing and the crew password from flash
        saveCrewPassword,  // write crewPassword() to flash; remove the file when empty
    };

    struct Result {
        Effect effect = Effect::none;
        char reply[96] = "";
    };

    // random: 32 random bits for the challenge (the hardware RNG on the ESP8266)
    PairingController(const char* deviceId, uint32_t (*random)());

    // What is stored on the flash; crewPassword is the one set by the Hub.
    void begin(const Pairing& stored, const char* crewPassword);

    static bool isManagementMessage(const char* data, size_t length);
    Result handle(const char* data, size_t length);

    const Pairing& pairing() const { return current; }
    // "" when the paired Hub has set none
    const char* crewPassword() const { return crew; }
    // 16 hex
    const char* challenge() const { return challengeText; }

private:
    void newChallenge();
    void refuse(Result& result, const char* verb, const char* why) const;

    const char* deviceId;
    uint32_t (*random)();
    Pairing current;
    char crew[maxCrewPassword + 1] = "";
    char challengeText[17] = "";
};

// The first 8 bytes of HMAC-SHA256(token, "crew-password-set <password>")
// as 16 hex; out needs 17 bytes.
static const size_t crewFingerprintSize = 8;
void crewPasswordFingerprint(const uint8_t* token, const char* password, char* out);

// Lowercase hex of the bytes; out needs 2 * length + 1 bytes.
void toHex(const uint8_t* bytes, size_t length, char* out);
// false unless text is exactly 2 * length hex digits
bool fromHex(const char* text, uint8_t* bytes, size_t length);

}  // namespace gctally
