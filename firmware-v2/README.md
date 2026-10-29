# GC Tally firmware v2 (ESP8266, C++)

Firmware v2 replaces the NodeMCU/Lua firmware in [`../tally`](../tally) with C++ built with
[PlatformIO](https://platformio.org) and the ESP8266 Arduino core. It is stage 1 of the plan in
#31 (issue #26): the same lights, the same settings file and the same UDP protocol as v1, so the
current Hub drives v1 and v2 lights side by side. Stage 2 (#27) adds the setup page: Wi-Fi and
name from a phone, without USB after the first flash. Stage 3 (#28) starts with finding the
Hub without its IP address. Pairing, remote management, OTA and ESP-NOW (#28–#30, #25) build on
it later.

**Status: not tested on hardware yet.** The logic is tested on a computer and against a running
Hub (see [Tests](#tests)); the D1 Mini build compiles in CI. Keep v1 on lights used in
productions until the hardware checks in #26 pass. v1 stays available and unchanged.

## Building

```sh
pip install platformio==6.2.0
cd firmware-v2
pio test -e native      # unit tests of the tally logic, no hardware needed
pio run -e d1_mini      # .pio/build/d1_mini/firmware.bin
```

CI (`.github/workflows/firmware-v2.yml`) runs the same commands and keeps `firmware.bin` as the
artifact `gc-tally-firmware-v2-d1-mini`.

## Flashing a D1 Mini

Over USB, once per board. This replaces NodeMCU and the Lua files; to go back to v1, flash
NodeMCU again with `flash-nodemcu.cmd` from the Windows ZIP and upload the Lua files from the
Hub.

1. Create `firmware-v2/data/tally-settings.ini` (the folder is ignored by git, so your Wi-Fi
   password never ends up in the repository). The file is the same as for v1, e.g. start from
   [`../tally/examples/d1-mini-ws2812-4x4.ini.example`](../tally/examples/d1-mini-ws2812-4x4.ini.example).
   The setup access point uses the crew password built into the firmware (see
   [Setup and recovery](#setup-and-recovery)); `setup.password` in the file overrides it for
   this one tally. Without a settings file the tally starts in setup
   mode and Wi-Fi and name can be set from a phone.
2. Flash the firmware and the settings, with the crew password for the setup access point:

   ```sh
   export GC_SETUP_PASSWORD='the crew password'
   pio run -e d1_mini -t upload
   pio run -e d1_mini -t uploadfs
   ```

   Without PlatformIO, `firmware.bin` from CI can be flashed with esptool:
   `esptool --port COM3 write_flash 0x0 firmware.bin` (the settings still need `uploadfs`).
3. `pio device monitor` shows the log at 115200 baud.

A Windows flash flow for v2 in the release ZIP comes with a later step of #26.

## Settings

`tally-settings.ini` on LittleFS, the same keys as v1 (see [`../tally/Readme.md`](../tally/Readme.md)):
`station.ssid`, `station.password`, `hub.ip`, `hub.port`, `tally.name`, `operator.type`,
`operator.ws2812`, `stage.type`, `stage.ws2812`. Lines starting with `;` are comments.

`hub.ip` may be left out in v2: the tally then finds the Hub on its own (see
[Finding the Hub](#finding-the-hub)). v1 always needs it.

New in v2 (v1 warns about them in its log and works on):

| Key | Default | |
| --- | --- | --- |
| `hub.id` | none | Use only this Hub when looking for one: the 8 characters on the Hub's Configuration page |
| `setup.password` | crew password | Password of the setup access point for this tally, 8 to 63 printable ASCII characters; overrides the crew password |
| `setup.recovery-after` | `30` | Seconds without Wi-Fi before the recovery access point starts; `0` turns it off |

Differences from v1:

- a value may contain `=`, so a Wi-Fi password with `=` works (v1 ignores such a line);
- an invalid `hub.port` is reported and 7411 is kept (v1 then cannot reach the Hub).

Nothing is written to flash while the tally runs: no Wi-Fi credentials stored by the SDK
(`WiFi.persistent(false)`), no state, logs, counters, reconnects or retries. The file changes only
when someone saves the setup page (see below).

## Setup and recovery

The tally opens its own Wi-Fi access point **`GreenCrew-Tally-<id>`** (`<id>` as in `tally-ho`,
see [Protocol](#protocol)) with the setup page at **http://192.168.4.1/**. Phones usually open the
page on their own after joining; if not, type the address. The page is in Polish when the
browser prefers Polish, otherwise in English.

The access point starts:

| When | What runs | Light (operator) |
| --- | --- | --- |
| No valid settings (no `station.ssid`), e.g. a freshly flashed board | setup mode: only the access point | purple, 1 s on, 1 s off |
| Reset pressed twice within 3 s | setup mode | purple |
| New settings did not connect | setup mode with the reason | purple |
| A configured tally had no Wi-Fi for `setup.recovery-after` seconds | recovery: the tally keeps trying its network and drives the lights; the access point stops once the network is back and nobody uses the page | as without Wi-Fi |

A configured tally leaves setup mode by itself after 5 minutes without anyone on the page.

**Password.** The access point is WPA2. Its password is, in this order:

1. `setup.password` from the settings file, for one tally;
2. the crew password, the same on every tally: set `GC_SETUP_PASSWORD` (8 to 63 printable ASCII
   characters) when building, as in [Flashing a D1 Mini](#flashing-a-d1-mini). The build prints
   `Crew setup password: built in`;
3. without either, a password the tally generates once, stores in `/setup-key` on the flash and
   prints on the serial console at every boot (`pio device monitor`):

   ```
   [INFO]  Setup access point GreenCrew-Tally-a1b2c3, password 7kq2m9xwtd, page http://192.168.4.1/
   ```

The crew password is never printed. It is not in the repository and the firmware built by CI
does not have it: the repository and its CI builds are public, and anyone with a firmware file
can read the password from it. Keep firmware files with the crew password inside the crew.
Changing the crew password from the Hub on every paired tally comes with pairing (#28).

The password is never sent to the Hub or shown on the page; the stored Wi-Fi password is not
shown either (an empty field keeps it). The page only answers devices on the access point, not
on the show network.

**The page** lists the networks nearby and sets the Wi-Fi network and password, the tally name and
the Hub: leave the address empty to find the Hub on its own, and enter the Hub ID if several Hubs
share the network.
Communication is Wi-Fi + UDP; ESP-NOW (#25) will be chosen here later, deliberately, never as an
automatic fallback. The ESP8266 sees only 2.4 GHz networks and cannot join WPA3-only networks.

**Saving tries first.** The page writes the new settings next to the old ones and restarts. The
tally then has 40 seconds to get an IP address on the new network:

- it works: the new settings replace the old ones;
- it does not: the new settings are dropped and the tally comes back in setup mode with the reason
  (network not found, wrong password, no IP address). The old settings were never touched;
- power is lost during the trial: same as not working.

Files on LittleFS: `/tally-settings.ini` (in use), `/tally-settings.new` (saved, not tried yet),
`/tally-settings.trial` (being tried), `/setup-key`. Each write goes to a temporary file that is
then renamed, which LittleFS does atomically, so a power loss never leaves half a file. Flash is
written when saving the page, when the new settings are accepted, and once for `/setup-key`. The
double reset and the reason of a failed trial are kept in the RTC memory, which survives a reset
but not a power loss, so they need no flash writes either.

**Radio.** The ESP8266 has one radio. While the recovery access point runs next to the station,
both use the station's channel, and every connection attempt to the show network scans other
channels and briefly disturbs phones on the access point. So while someone is on the page, the
tally tries its network only every 30 s. A future ESP-NOW mode shares the channel the same way.

## Finding the Hub

Without `hub.ip` the tally looks for the Hub over mDNS (DNS-SD), so a Hub that got a new address
from DHCP is found again without touching the tally.

- The Hub announces `GC Tally Hub <id>._gctally._udp.local` on the tally port, with the host
  name `gctally-hub-<id>.local` and the TXT record `v=1 id=<id> name=<computer>`. `<id>` is a
  random id the Hub creates once and keeps in its configuration; it is shown on the
  Configuration page ("Hub discovery"). `GC_TALLY_MDNS=off` turns the announcement off.
- The tally asks for `_gctally._udp` after getting an IP address. The ESP8266 query returns
  host names, addresses and ports (no TXT), so the id is read from the host name.
- **One Hub** on the network: the tally uses it. **Several Hubs** and no `hub.id`: the tally
  uses none and logs the ids it saw, so it never ends up on the wrong Hub by chance. With
  `hub.id` it uses only that Hub.
- Nothing found: the tally asks again after 3 s, doubling up to 30 s, and logs why (Hub not
  running, or multicast blocked by client isolation or a multicast filter: then set `hub.ip`).
- After 3 searches in a row with no answer at all (not "several Hubs"/"wrong hub.id", where
  multicast clearly does work), the tally also guesses the network's default gateway as the
  Hub's address and logs it once — useful on a phone hotspot (#22, stage 2 of #19), where the
  Hub-running device is usually also the only router, and some phones filter multicast so mDNS
  never gets an answer even though the Hub is reachable. mDNS keeps retrying in the background
  and replaces the guess the moment it actually finds a Hub.
- A Hub that stays silent for 10 s is looked up again (new address, restarted Hub). A search
  takes about a second and only runs while no Hub is connected.
- The address found is kept in RAM only; nothing is written to flash.
- The tally announces itself too, as `_gctally-device._udp` with `v`, `id`, `fw` and `name` in
  TXT, for the Hub's device list in a later step of #28.

`hub.ip` (an IP address or a DNS name) always wins and works on every network. Pairing (a tally
that only follows its own Hub after confirming it on the Hub) is the next step of #28; until then
`hub.id` is a preference, not a security measure.

## Pins

The same as v1, so a light built for v1 works unchanged:

| Function | Pin |
| --- | --- |
| WS2812 strip (operator lights first, then stage) | D4 / GPIO2 (UART1) |
| Operator light red, green, blue (PWM) | D2, D1, D3 |
| Stage light red, green, blue (PWM) | D6, D5, D7 |
| On-board LED (on while running, blinks with blue status patterns) | D0 / GPIO16 |

PWM runs at 1 kHz with 256 steps (v1: 100 steps).

## What the tally does (parity with v1)

| Situation | Operator light |
| --- | --- |
| Settings invalid (v1: no `station.ssid` or `hub.ip`) | v1: blue, 3 short blinks, pause. v2: setup access point, purple (see [Setup and recovery](#setup-and-recovery)) |
| Connecting to Wi-Fi | blue, blinks every 500 ms |
| Connected, waiting for an IP | blue, blinks every 250 ms |
| No packet from the Hub for 3 s | blue, two short blinks, pause |
| Hub packets | exactly what the Hub sends (Program, Preview, AUX, UNKNOWN, highlight) |

A dim step is 30 % of the colour, rounded up. Sending the pattern that is already running does
not restart it. It says `tally-ho` every second while it has an IP.

One difference: after losing the Wi-Fi v1 tries again every 2 s. v2 starts with 2 s and doubles
the wait after each failure in a row, up to 30 s (200 ms for the first two expired
authentications or DHCP timeouts, as in v1); the first success resets it. An attempt that reports
nothing for 20 s counts as failed.

## Protocol

Unchanged UDP port 7411 and messages, plus a description of the device after the name:

```
tally → Hub   tally-ho "CAM1" gc/1 id=a1b2c3 fw=2.0.0-dev hw=esp8266 caps=ws2812,pwm
tally → Hub   log "CAM1" INFO "Got IP 192.168.1.23"
Hub → tally   O255/000/000 S255/000/000
Hub → tally   O000/000/255 S000/000/000 0x80 250
```

- `gc/1`: version 1 of these fields. A newer version may add `key=value` fields; the Hub skips
  keys it does not know.
- `id`: the ESP8266 chip id in hex, stable across renames and IP changes. It identifies the
  device; it is **not** a secret and not an authentication (pairing comes with #28).
- `fw`: firmware version; `hw`: hardware family; `caps`: what the firmware can drive.

The Hub (from this version) shows the firmware version on the tally card and keeps the fields
in memory only. Older Hubs and vTally read the name between the quotes and ignore the rest, as
long as nothing after the name contains `"`. The name must not contain `"` either, as with v1.

## Flash and RAM

Measured from the CI build (`pio run -e d1_mini -t size`), version 2.0.0-dev:

| | Used | Available |
| --- | --- | --- |
| Sketch (flash) | 388 KB | 1020 KB with `eagle.flash.4m1m.ld` |
| RAM, static | 38 KB | 80 KB |

Layout `eagle.flash.4m1m.ld` (4 MB boards like the D1 Mini): 1 MB sketch area, 1 MB LittleFS,
the rest free. An OTA update (#30) on the ESP8266 needs the new image to fit next to the running
one in the sketch area, so with about 388 KB per image OTA fits on 4 MB boards. On 1 MB modules
(ESP-01, some clones) the space is tight and must be measured on the real module before
promising OTA there. The ESP8266 has no rollback to the previous image after a bad update; USB
stays the recovery path.

To be measured on real boards (#26): free heap while running, flash size of every board variant
in use (`esptool flash_id`).

## Code layout

- `lib/tally_core/`: the tally logic without hardware, tested on a computer
  - `StateMessage`: parses the Hub's colour messages
  - `LedEngine`: static colours, flash patterns, status patterns
  - `LightOutput`: PWM levels, WS2812 bytes and the on-board LED for a frame
  - `Settings`: reads `tally-settings.ini`
  - `LogBuffer`: logs kept until the Hub can receive them
  - `TallyController`: Wi-Fi events, Hub timeout, `tally-ho` and logs
  - `WifiSupervisor`: reconnect backoff, recovery access point, trial of new settings
  - `HubFinder`: which Hub to use and when to look for it; `GatewayFallback`: when to guess the
    default gateway as the Hub after mDNS keeps finding nothing
  - `SetupForm`: checks the setup page and writes the settings file
  - `SetupPage`: the setup page (HTML, Polish and English)
- `src/main.cpp`: ESP8266 hardware (Wi-Fi, UDP, mDNS, pins), setup mode, double reset
- `src/ConfigStore.cpp`: the settings files on LittleFS
- `src/Portal.cpp`: access point, DNS and web server of the setup page
- `sim/`: the logic as a Linux program that talks UDP to a Hub
- `test/test_core/`: unit tests

## Tests

- `pio test -e native`: unit tests. The expected values come from the v1 Lua code and from
  what the Hub sends. Also the setup page: form checks, the settings file after saving, the
  backoff, the recovery access point and the trial timing, and that the page never contains the
  password. Also the choice of Hub (one, several, pinned) and the search timing.
- `cd ../hub && npm run build:backend && node scripts/check-hub-mdns.cjs`: the running Hub
  announces itself the way the tally asks for it, and says goodbye when it stops.
- `make -C sim && (cd ../hub && npm run build:backend && node scripts/check-firmware-v2-sim.cjs)`:
  the tally logic against a real running Hub: the Hub recognises the v2 tally and its firmware;
  UNKNOWN, Program, Preview, AUX and highlight colours; keep-alives do not redraw a static colour;
  the lost Hub after 3 s; the reconnect after the Hub restarts.

Not covered without hardware: the pins, the WS2812 timing, Wi-Fi behaviour, the access point and
the captive portal on real phones, power loss, the double reset, the mDNS query of the ESP8266
on real networks (including multicast filtering and client isolation).
