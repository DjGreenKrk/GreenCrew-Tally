// The firmware v2 tally logic on a computer, talking UDP to a real Hub.
// Used by hub/scripts/check-firmware-v2-sim.cjs; the Wi-Fi is always up and
// the lights are printed instead of driven:
//   frame O255/000/000 S255/000/000
//   console [INFO]  Contacting hub on 127.0.0.1:7411
//   pairing paired hub=1a2b3c4d crew=
// Pairing is kept in RAM only.
//
// Build: make -C firmware-v2/sim
// Run:   firmware-v2/sim/.build/gc-tally-sim tally-settings.ini [device-id]

#include <arpa/inet.h>
#include <netdb.h>
#include <poll.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

#include <fstream>
#include <random>
#include <sstream>
#include <string>

#include "LedEngine.h"
#include "Pairing.h"
#include "Settings.h"
#include "TallyController.h"

using namespace gctally;

namespace {

uint32_t millis() {
    timespec now;
    clock_gettime(CLOCK_MONOTONIC, &now);
    return static_cast<uint32_t>(now.tv_sec * 1000 + now.tv_nsec / 1000000);
}

class SimPlatform : public Platform {
public:
    SimPlatform(int socket, const sockaddr_in& hub) : socket(socket), hub(hub) {}
    void sendToHub(const char* text) override {
        sendto(socket, text, strlen(text), 0, reinterpret_cast<const sockaddr*>(&hub), sizeof(hub));
    }
    void printLine(const char* text) override {
        printf("console %s\n", text);
        fflush(stdout);
    }

private:
    int socket;
    sockaddr_in hub;
};

std::random_device randomDevice;
uint32_t simRandom() { return randomDevice(); }

void printFrame(const Frame& frame) {
    const Color& o = frame.operatorColor;
    const Color& s = frame.stageColor;
    printf("frame O%03u/%03u/%03u S%03u/%03u/%03u\n", o.r, o.g, o.b, s.r, s.g, s.b);
    fflush(stdout);
}

}  // namespace

int main(int argc, char** argv) {
    if (argc < 2) {
        fprintf(stderr, "usage: %s tally-settings.ini [device-id]\n", argv[0]);
        return 2;
    }
    std::ifstream file(argv[1]);
    if (!file) {
        fprintf(stderr, "cannot read %s\n", argv[1]);
        return 2;
    }
    std::stringstream text;
    text << file.rdbuf();
    const char* deviceId = argc > 2 ? argv[2] : "5e5e5e";

    Settings settings(deviceId);
    settings.parse(text.str().c_str());

    sockaddr_in hub = {};
    hub.sin_family = AF_INET;
    hub.sin_port = htons(settings.hubUdpPort());
    if (inet_pton(AF_INET, settings.hubAddress(), &hub.sin_addr) != 1) {
        fprintf(stderr, "hub.ip must be an IPv4 address\n");
        return 2;
    }
    // any free port: the Hub answers to where the packets come from
    int sock = socket(AF_INET, SOCK_DGRAM, 0);
    sockaddr_in local = {};
    local.sin_family = AF_INET;
    if (sock < 0 || bind(sock, reinterpret_cast<sockaddr*>(&local), sizeof(local)) != 0) {
        perror("socket");
        return 1;
    }

    SimPlatform platform(sock, hub);
    LedEngine leds;
    TallyController controller(settings, deviceId, leds, platform);
    PairingController pairing(deviceId, simRandom);
    pairing.begin(Pairing(), "");
    controller.setPairing(&pairing);
    for (size_t i = 0; i < settings.warningCount(); i++) controller.log(Severity::warning, settings.warning(i));
    controller.begin(millis());
    if (!settings.isValid()) {
        fprintf(stderr, "settings need station.ssid and hub.ip\n");
        return 2;
    }
    controller.wifiConnecting(millis());
    controller.wifiAssociated(millis());
    controller.wifiGotIp(millis());

    while (true) {
        pollfd fd = {sock, POLLIN, 0};
        if (poll(&fd, 1, 5) > 0) {
            char packet[336];
            sockaddr_in sender = {};
            socklen_t senderSize = sizeof(sender);
            ssize_t length = recvfrom(sock, packet, sizeof(packet) - 1, 0, reinterpret_cast<sockaddr*>(&sender), &senderSize);
            if (length > 0 && PairingController::isManagementMessage(packet, length)) {
                PairingController::Result result = pairing.handle(packet, length);
                if (result.effect == PairingController::Effect::identify) controller.identify(millis());
                if (result.effect != PairingController::Effect::none && result.effect != PairingController::Effect::identify) {
                    printf("pairing %s hub=%s crew=%s\n", pairing.pairing().paired ? "paired" : "unpaired", pairing.pairing().hubId, pairing.crewPassword());
                }
                if (result.reply[0] != '\0') {
                    printf("reply %s", result.reply);
                    sendto(sock, result.reply, strlen(result.reply), 0, reinterpret_cast<sockaddr*>(&sender), senderSize);
                }
                fflush(stdout);
            } else if (length > 0) {
                controller.packetReceived(packet, length, millis());
            }
        }
        uint32_t now = millis();
        controller.tick(now);
        if (leds.tick(now)) printFrame(leds.frame());
    }
}
