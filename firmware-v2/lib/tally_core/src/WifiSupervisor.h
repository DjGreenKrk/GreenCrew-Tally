#pragma once

#include <stdint.h>

namespace gctally {

// Why the last connection attempt failed, for the setup page.
enum class WifiFailure : uint8_t {
    none,
    networkNotFound,
    wrongPassword,
    noIp,
    other,
};

// reason: the ESP8266 SDK disconnect reason (WIFI_DISCONNECT_REASON_*)
WifiFailure classifyDisconnect(uint8_t reason);

// When to connect to the Wi-Fi again, when to offer the recovery access
// point, and whether a new configuration on trial works. Only decides; the
// caller does the Wi-Fi calls. All state is in RAM.
class WifiSupervisor {
public:
    // Retry 2 s after a failure, doubling up to 30 s (v1 always waited 2 s).
    // Expired authentication and DHCP timeouts retry after 200 ms, as in v1,
    // for the first two failures in a row.
    static const uint32_t firstRetryMs = 2000;
    static const uint32_t maxRetryMs = 30000;
    static const uint32_t quickRetryMs = 200;
    // An attempt that reports nothing for this long counts as failed.
    static const uint32_t attemptTimeoutMs = 20000;
    // A new configuration must get an IP address within this time.
    static const uint32_t trialTimeoutMs = 40000;

    enum class Trial : uint8_t { none, running, succeeded, failed };

    // recoveryAfterMs: 0 never offers the recovery access point.
    // trial: the configuration was just saved and is not committed yet;
    // there is no recovery access point during a trial.
    WifiSupervisor(uint32_t recoveryAfterMs, bool trial);

    void begin(uint32_t nowMs);
    // True when the caller should call WiFi.begin() now (and then connectStarted()).
    bool connectDue(uint32_t nowMs);
    void connectStarted(uint32_t nowMs);
    void gotIp(uint32_t nowMs);
    void lost(uint32_t nowMs, uint8_t reason);
    void dhcpTimeout(uint32_t nowMs);
    // Devices connected to the recovery access point. While someone uses it,
    // it stays on and reconnects are rare, as they move the radio channel.
    void setApClients(uint8_t count) { apClients = count; }

    bool isWifiUp() const { return wifiUp; }
    bool recoveryApWanted(uint32_t nowMs) const;
    Trial trial(uint32_t nowMs) const;
    WifiFailure lastFailure() const { return failure; }
    // Delay before the next attempt, for the log.
    uint32_t retryDelayMs() const { return retryMs; }

private:
    void failed(uint32_t nowMs, bool quick);

    uint32_t recoveryAfterMs;
    bool trialRunning;
    bool trialSucceeded = false;
    uint32_t trialStartMs = 0;

    bool wifiUp = false;
    uint32_t downSinceMs = 0;
    bool connecting = false;
    uint32_t attemptStartMs = 0;
    bool retryPending = false;
    uint32_t retryAtMs = 0;
    uint32_t retryMs = 0;
    uint8_t failuresInRow = 0;
    uint8_t apClients = 0;
    WifiFailure failure = WifiFailure::none;
};

}  // namespace gctally
