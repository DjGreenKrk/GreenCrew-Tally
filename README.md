# GreenCrew Tally (GC Tally)

### Wi-Fi camera tally system

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Hub CI](https://github.com/DjGreenKrk/wifi-tally/actions/workflows/hub-ci.yml/badge.svg)](https://github.com/DjGreenKrk/wifi-tally/actions/workflows/hub-ci.yml) [![Windows bundle](https://github.com/DjGreenKrk/wifi-tally/actions/workflows/windows-bundle.yml/badge.svg)](https://github.com/DjGreenKrk/wifi-tally/actions/workflows/windows-bundle.yml) [![Tally bytecode](https://github.com/DjGreenKrk/wifi-tally/actions/workflows/tally-bytecode.yml/badge.svg)](https://github.com/DjGreenKrk/wifi-tally/actions/workflows/tally-bytecode.yml) [![Latest release](https://img.shields.io/github/v/release/DjGreenKrk/wifi-tally?include_prereleases&label=release)](https://github.com/DjGreenKrk/wifi-tally/releases) [![Release date](https://img.shields.io/github/release-date-pre/DjGreenKrk/wifi-tally?label=released)](https://github.com/DjGreenKrk/wifi-tally/releases) [![Last commit](https://img.shields.io/github/last-commit/DjGreenKrk/wifi-tally)](https://github.com/DjGreenKrk/wifi-tally/commits)

**GC Tally** is a Wi-Fi camera tally system, part of the GreenCrew Tools family. A local Hub
receives the Program / Preview / AUX state from your production (via Bitfocus Companion or
a supported mixer) and drives ESP8266 tally lights and browser-based web tallies.

GC Tally is a fork of a fork, and builds on the work of others:

| Project | Author | What it contributed |
| --- | --- | --- |
| [vTally / wifi-tally](https://github.com/wifi-tally/wifi-tally) ([docs](https://wifi-tally.github.io/)) | **Christian Zenker** and contributors | The original project: Hub, ESP8266/NodeMCU tally firmware, web tallies, ATEM / OBS / vMix / Roland integrations |
| [kuuminsh/wifi-tally](https://github.com/kuuminsh/wifi-tally) | **kuuminsh** | vMix improvements (several inputs per tally, per-project profiles, reliable XML parsing, reconnection) and Windows packaging; see [Fork-Changes.md](Fork-Changes.md) |
| [DjGreenKrk/wifi-tally](https://github.com/DjGreenKrk/wifi-tally) | **GreenCrew** | GC Tally: Companion 5 integration, AUX state, WS2812B 4×4 matrix lights, Node 24 Hub, verified USB flasher, all-in-one Windows bundle |

Thank you to Christian Zenker, kuuminsh and everyone who contributed to vTally.
The MIT license and the original copyright notice are kept in [LICENSE](LICENSE).

## Getting started (Windows)

Download the latest `gc-tally-windows-*.zip` from the
[releases](https://github.com/DjGreenKrk/wifi-tally/releases), unpack the whole ZIP into one
folder and follow **`START-TUTAJ.txt`** inside. It covers everything from a brand-new ESP8266
to a working show:

1. start `gc-tally.exe` (Hub on http://localhost:3000, tallies on UDP 7411);
2. flash the base NodeMCU firmware onto each new ESP8266 with `flash-nodemcu.cmd`
   (esptool and the firmware image are included);
3. install the tally application and settings from the Hub's **Flash** page;
4. patch tallies to camera channels;
5. import the Companion module from `companion\` and connect it to the Hub.

## Tally colours

| Light | Meaning |
| --- | --- |
| red | Program (on air) |
| orange | AUX (camera routed to an AUX output) |
| green | Preview |
| off | camera not in use |
| blue, short flash every 2 s | the Hub has no data from Companion / the mixer (state unknown) |
| blue, fast double blink | the tally cannot reach the Hub |
| white, flashing | highlight, sent from the Hub to identify a light |

Priority is Program > AUX > Preview. The Yellow-Pink scheme (for red-green colour blindness)
uses yellow / cyan / pink instead.

## Components

| Directory | Purpose | Runtime |
| --- | --- | --- |
| `hub/` | GC Tally Hub: web UI, mixer and Companion integrations, Web/UDP tallies, USB flasher | Node.js 24; packaged as `gc-tally.exe` |
| `companion-module-greencrew-vtally/` | Bitfocus Companion 5 module "GreenCrew Tally" | Node.js 22.20+ |
| `tally/` | ESP8266 NodeMCU Lua tally application, shipped as precompiled bytecode in `tally/out` | NodeMCU 3.0 firmware |
| `release/windows/` | First-flash script and guide included in the Windows ZIP | Windows |

Some technical names keep the original spelling so that existing setups continue to work:
the Hub configuration file `~/.wifi-tally.json`, the Companion module id `greencrew-vtally`,
the environment variable `VTALLY_COMPANION_TOKEN` and the UDP protocol.

## Companion and the HTTP API

The Companion module sends complete snapshots to `POST /api/companion/tally` about once per
second:

```json
{"programs":["1"],"previews":["2"],"auxes":["3"]}
```

`auxes` is optional. Without a new snapshot for more than 4 seconds the Hub reports UNKNOWN
rather than assuming the cameras are off. Details, the LAN token and a PowerShell smoke test:
[hub/COMPANION-HTTP.md](hub/COMPANION-HTTP.md) and the
[module README](companion-module-greencrew-vtally/README.md).

## Hardware

The reference tally is an **ESP8266 D1 Mini with a 4×4 WS2812B matrix** on D4/GPIO2, powered
from 5 V with a common ground. See [tally/D1-MINI-4X4.md](tally/D1-MINI-4X4.md) and the
[example settings](tally/examples/d1-mini-ws2812-4x4.ini.example). Classic vTally RGB LED
wiring still works; see the [original documentation](https://wifi-tally.github.io/).

## Development

```sh
cd hub
npm ci
npm run lint && npx tsc --noEmit -p . && npm test
npm run build:windows          # Windows: dist/gc-tally.exe + dist/frontend + dist/esp8266

cd ../companion-module-greencrew-vtally
npm install && npm test && npm run package

make -C tally build            # rebuild tally/out bytecode (needs luac.cross, see tally/scripts)
```

CI: `hub-ci.yml` (Linux checks, Chromium and a running Hub), `windows-bundle.yml` (EXE, Companion
module, release ZIP, tested on Windows), `tally-bytecode.yml` (committed bytecode matches the
sources) and `dependency-audit.yml`. Planned work: [ROADMAP.md](ROADMAP.md).

## Credits

Icons from the Noun Project by
[Eucalyp](https://thenounproject.com/browse/?i=3151803),
[Atif Arshad](https://thenounproject.com/browse/?i=1294543),
[priyanka](https://thenounproject.com/browse/?i=1637910),
[Hrbon](https://thenounproject.com/browse?i=3014911) and
[ProSymbols](https://thenounproject.com/browse/?i=1086042), all licensed
[CC-BY-3.0](https://creativecommons.org/licenses/by/3.0/us/legalcode).
