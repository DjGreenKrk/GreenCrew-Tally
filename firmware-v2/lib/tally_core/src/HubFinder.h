#pragma once

#include <stddef.h>
#include <stdint.h>

namespace gctally {

// One answer to the mDNS query for _gctally._udp (see hub/src/lib/HubAnnouncer.ts).
struct HubAnswer {
    const char* hostName;  // "gctally-hub-1a2b3c4d" or "gctally-hub-1a2b3c4d.local"
    uint32_t ip;
    uint16_t port;
};

// The Hub id from the announced host name; false for other host names.
bool hubIdFromHostName(const char* hostName, char* id, size_t size);

enum class HubSearch : uint8_t {
    found,
    none,           // no Hub answered: not running, or multicast is blocked
    several,        // more than one Hub and no hub.id: the tally does not guess
    pinnedMissing,  // Hubs answered, but not the one in hub.id
};

// Picks the Hub to use: the one with the pinned id, or the only one.
// Answers repeated for several network interfaces of the same Hub count once.
HubSearch chooseHub(const HubAnswer* answers, size_t count, const char* pinnedId, size_t& chosen);

// A paired tally talks only to its own Hub: one found before it was paired
// (or before it was paired again elsewhere) is not used, even when the next
// search finds nothing. pairedId is "" when not paired.
bool isUsableHub(const char* foundId, const char* pairedId);

// When to look for the Hub over mDNS (only without hub.ip). A search blocks
// for about a second, so it runs only while no Hub is connected: right after
// getting an IP, again 3 s after a failed search doubling up to 30 s, and
// after the Hub has been silent for 10 s (it may have a new address).
// Nothing is stored: the tally searches again after every restart.
class HubFinder {
public:
    static const uint32_t firstRetryMs = 3000;
    static const uint32_t maxRetryMs = 30000;
    static const uint32_t lostHubMs = 10000;

    void wifiUp(uint32_t nowMs);
    void wifiDown();
    bool searchDue(uint32_t nowMs, bool hubConnected);
    void searchDone(uint32_t nowMs, HubSearch result);

    bool hasHub() const { return known; }
    // Failed searches in a row (for logging the diagnosis once, not every time).
    uint8_t failures() const { return failuresInRow; }

private:
    bool wifi = false;
    bool known = false;
    bool silent = false;
    uint32_t silentSinceMs = 0;
    uint32_t nextSearchMs = 0;
    uint8_t failuresInRow = 0;
};

}  // namespace gctally
