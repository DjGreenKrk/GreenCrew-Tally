#include "HubFinder.h"

#include <string.h>

#include "Settings.h"

namespace gctally {

namespace {

const char* hostPrefix = "gctally-hub-";

bool reached(uint32_t nowMs, uint32_t atMs) { return static_cast<int32_t>(nowMs - atMs) >= 0; }

}  // namespace

bool hubIdFromHostName(const char* hostName, char* id, size_t size) {
    size_t prefix = strlen(hostPrefix);
    if (hostName == nullptr || strncmp(hostName, hostPrefix, prefix) != 0 || size < 9) return false;
    const char* start = hostName + prefix;
    const char* end = strchr(start, '.');
    size_t length = end ? static_cast<size_t>(end - start) : strlen(start);
    if (length != 8) return false;
    memcpy(id, start, 8);
    id[8] = '\0';
    return isHubId(id);
}

HubSearch chooseHub(const HubAnswer* answers, size_t count, const char* pinnedId, size_t& chosen) {
    bool pinned = pinnedId != nullptr && pinnedId[0] != '\0';
    char firstId[9] = "";
    bool any = false;
    for (size_t i = 0; i < count; i++) {
        char id[9];
        if (!hubIdFromHostName(answers[i].hostName, id, sizeof(id)) || answers[i].ip == 0) continue;
        if (pinned) {
            if (strcmp(id, pinnedId) == 0) {
                chosen = i;
                return HubSearch::found;
            }
            any = true;
            continue;
        }
        if (!any) {
            any = true;
            memcpy(firstId, id, sizeof(firstId));
            chosen = i;
        } else if (strcmp(id, firstId) != 0) {
            return HubSearch::several;
        }
    }
    if (pinned) return any ? HubSearch::pinnedMissing : HubSearch::none;
    return any ? HubSearch::found : HubSearch::none;
}

void HubFinder::wifiUp(uint32_t nowMs) {
    wifi = true;
    nextSearchMs = nowMs;
}

void HubFinder::wifiDown() { wifi = false; }

bool HubFinder::searchDue(uint32_t nowMs, bool hubConnected) {
    if (!wifi) return false;
    if (hubConnected) {
        silent = false;
        return false;
    }
    if (known) {
        if (!silent) {
            silent = true;
            silentSinceMs = nowMs;
        }
        if (!reached(nowMs, silentSinceMs + lostHubMs)) return false;
    }
    return reached(nowMs, nextSearchMs);
}

void HubFinder::searchDone(uint32_t nowMs, HubSearch result) {
    if (result == HubSearch::found) {
        known = true;
        failuresInRow = 0;
        silent = false;
        nextSearchMs = nowMs;
        return;
    }
    if (failuresInRow < 255) failuresInRow++;
    uint8_t doublings = failuresInRow - 1 < 4 ? failuresInRow - 1 : 4;
    uint32_t delay = firstRetryMs << doublings;
    nextSearchMs = nowMs + (delay > maxRetryMs ? maxRetryMs : delay);
}

bool GatewayFallback::searchDone(HubSearch result) {
    if (result != HubSearch::none) {
        noneInRow = 0;
        return false;
    }
    if (noneInRow < 255) noneInRow++;
    return noneInRow == afterFailures;
}

}  // namespace gctally
