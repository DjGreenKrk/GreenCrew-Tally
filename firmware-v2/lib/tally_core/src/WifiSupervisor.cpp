#include "WifiSupervisor.h"

namespace gctally {

namespace {

// From the ESP8266 SDK (user_interface.h)
const uint8_t reasonAuthExpire = 2;
const uint8_t reasonFourWayHandshakeTimeout = 15;
const uint8_t reasonNoApFound = 201;
const uint8_t reasonAuthFail = 202;
const uint8_t reasonHandshakeTimeout = 204;

bool reached(uint32_t nowMs, uint32_t atMs) { return static_cast<int32_t>(nowMs - atMs) >= 0; }

}  // namespace

WifiFailure classifyDisconnect(uint8_t reason) {
    switch (reason) {
        case reasonNoApFound:
            return WifiFailure::networkNotFound;
        case reasonAuthFail:
        case reasonFourWayHandshakeTimeout:
        case reasonHandshakeTimeout:
            return WifiFailure::wrongPassword;
        default:
            return WifiFailure::other;
    }
}

WifiSupervisor::WifiSupervisor(uint32_t recoveryAfterMs, bool trial) : recoveryAfterMs(recoveryAfterMs), trialRunning(trial) {}

void WifiSupervisor::begin(uint32_t nowMs) {
    downSinceMs = nowMs;
    trialStartMs = nowMs;
    retryPending = true;
    retryAtMs = nowMs;
}

bool WifiSupervisor::connectDue(uint32_t nowMs) {
    if (connecting && reached(nowMs, attemptStartMs + attemptTimeoutMs)) {
        connecting = false;
        failure = WifiFailure::other;
        failed(nowMs, false);
    }
    if (!retryPending || !reached(nowMs, retryAtMs)) return false;
    if (apClients > 0 && !reached(nowMs, retryAtMs - retryMs + maxRetryMs)) return false;
    retryPending = false;
    return true;
}

void WifiSupervisor::connectStarted(uint32_t nowMs) {
    connecting = true;
    attemptStartMs = nowMs;
}

void WifiSupervisor::gotIp(uint32_t) {
    wifiUp = true;
    connecting = false;
    retryPending = false;
    failuresInRow = 0;
    failure = WifiFailure::none;
    if (trialRunning) {
        trialRunning = false;
        trialSucceeded = true;
    }
}

void WifiSupervisor::lost(uint32_t nowMs, uint8_t reason) {
    failure = classifyDisconnect(reason);
    failed(nowMs, reason == reasonAuthExpire);
}

void WifiSupervisor::dhcpTimeout(uint32_t nowMs) {
    failure = WifiFailure::noIp;
    failed(nowMs, true);
}

void WifiSupervisor::failed(uint32_t nowMs, bool quick) {
    if (wifiUp) downSinceMs = nowMs;
    wifiUp = false;
    connecting = false;
    if (failuresInRow < 255) failuresInRow++;
    if (quick && failuresInRow <= 2) {
        retryMs = quickRetryMs;
    } else {
        uint8_t doublings = failuresInRow - 1 < 5 ? failuresInRow - 1 : 5;
        retryMs = firstRetryMs << doublings;
        if (retryMs > maxRetryMs) retryMs = maxRetryMs;
    }
    retryPending = true;
    retryAtMs = nowMs + retryMs;
}

bool WifiSupervisor::recoveryApWanted(uint32_t nowMs) const {
    if (trialRunning || recoveryAfterMs == 0) return false;
    if (apClients > 0) return true;
    return !wifiUp && nowMs - downSinceMs >= recoveryAfterMs;
}

WifiSupervisor::Trial WifiSupervisor::trial(uint32_t nowMs) const {
    if (trialSucceeded) return Trial::succeeded;
    if (!trialRunning) return Trial::none;
    return nowMs - trialStartMs >= trialTimeoutMs ? Trial::failed : Trial::running;
}

}  // namespace gctally
