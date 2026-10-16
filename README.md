# GreenCrew vTally

**vTally** is a camera tally system with a local Hub, web tallies and ESP8266/NodeMCU hardware tallies. This fork adds a **Bitfocus Companion 5** integration for Program/Preview snapshots, including a native Companion module.

> **Development status:** This branch is the work-in-progress implementation in [PR #1](https://github.com/DjGreenKrk/wifi-tally/pull/1), not a verified hardware release. Windows Hub and OBS → Companion → Web Tally have been exercised; physical D1 Mini/WS2812B, ATEM and vMix end-to-end tests remain outstanding.

## Components

| Component | Purpose | Runtime |
| --- | --- | --- |
| `hub/` | vTally Hub backend, browser UI, Web/UDP distribution, USB NodeMCU application uploader | Windows build: Node.js 16 |
| `companion-module-greencrew-vtally/` | Native Bitfocus Companion 5 integration | Node.js 22.20+ for module development |
| `tally/` | ESP8266 NodeMCU Lua tally application | Compatible NodeMCU Lua firmware required |

The Hub HTTP interface normally uses **TCP 3000**. Hardware tally communication uses **UDP 7411**. These ports serve different purposes.

## Quick start: Hub on Windows

1. Install Node.js **16** and dependencies required by the legacy Hub. From `hub/`, run `npm install`.
2. Build with `npm run build:windows`.
3. Start `hub/dist/vtally.exe` and open `http://localhost:3000` (unless configured otherwise).
4. In **Video Mixer**, choose **Companion (HTTP)** and save.
5. Create Web Tallies and patch them to the desired numbered camera channels (1–8).
6. Connect the native Companion module or send full HTTP snapshots to the Hub.

The packaged Windows distribution needs the **`esp8266/` directory beside `vtally.exe`** to upload application files to physical devices. Do not distribute the EXE alone if USB programming is required. `npm run build:tray` builds an Electron portable wrapper with the additional resources.

> Building an EXE is not proof that serial flashing works. Verify the USB flasher with a real ESP8266 and a serial upload/readback before relying on it on a show.

## Companion 5 integration

Build/install the module using [its README](companion-module-greencrew-vtally/README.md). In Companion, configure:

- Hub host/IP: `127.0.0.1` for a local Hub, or the trusted LAN address of a remote Hub.
- Hub port: `3000` by default.
- Hub access token: empty for loopback; required for remote LAN requests.
- Camera count: **1–8**, default **3**.

For OBS, ATEM or vMix, prefer the **Sync Program + Preview from Companion variables** action, with a single trigger for changes to either source Program or Preview variable. Map the source's exact scene/input values to camera IDs. For OBS Studio Mode, an example is `$(obs_local_2:scene_active)` and `$(obs_local_2:scene_preview)`; replace the connection ID with your own.

The module can also manually set Program/Preview, TAKE, clear cameras and send full snapshots. **Manual actions do not automatically detect the real switcher's state.** Ensure Companion is driven by authoritative source variables/triggers when accurate on-air indication matters.

### HTTP API

`POST /api/companion/tally` replaces the **entire** Program/Preview snapshot. Both arrays are mandatory, with unique camera IDs 1–8:

```json
{"programs":["1"],"previews":["2"]}
```

`GET /api/companion/tally` returns status including `active`, `receiving`, `ageMs`, `timeoutMs`, `programs` and `previews`. A local smoke test:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/companion/tally' -Method Post -ContentType 'application/json' -Body '{"programs":["1"],"previews":["2"]}'
```

The native module sends a heartbeat approximately every **1 second**. If no new valid snapshot reaches the Hub for more than **4 seconds**, the Hub marks Program/Preview **UNKNOWN**, rather than asserting that cameras are OFF. Operator tallies use the existing blue warning pattern. An empty snapshot (`{"programs":[],"previews":[]}`) is an intentional blackout, **not** the same as UNKNOWN.

### Remote Hub on LAN

On the Hub machine, set `VTALLY_COMPANION_TOKEN` (minimum 16 characters) **before starting the Hub**. Supply the same token in the Companion module. Requests from loopback do not require a token; remote requests require `Authorization: Bearer <token>`. The module and Hub **must both be updated** for remote operation.

Traffic is plain HTTP, including the token. Use only an isolated/trusted production LAN or a secure tunnel; **never expose port 3000 to the public internet**. See [module README](companion-module-greencrew-vtally/README.md#hub-on-a-different-computer-lan) for a PowerShell token-generation example.

## Physical tally: D1 Mini and WS2812B

The planned hardware target is an **ESP8266 D1 Mini with a 4×4 WS2812B matrix** (16 pixels, single-color tally indication). The data signal uses **D4/GPIO2**; it is a bootstrapping pin and must not be forced LOW at boot. Power the matrix from a suitable **5 V supply** with common ground; do not power 16 pixels from the ESP's 3.3 V rail.

**Two separate firmware stages:**

1. Flash a compatible **base NodeMCU Lua firmware image** with the required modules onto the ESP8266. The Hub does **not** flash the base `.bin`.
2. Use the Hub USB flasher to upload the vTally Lua application files (`init.lua` plus `my-*.lua` or `my-*.lc`) and configure `tally-settings.ini` (Wi-Fi, Hub IP, UDP port, tally name).

See [D1 Mini hardware and firmware instructions](tally/D1-MINI-4X4.md) and the [sample configuration](tally/examples/d1-mini-ws2812-4x4.ini.example). Hardware flashing, color order, boot behavior and Wi-Fi loss behavior still need physical verification.

## Development and validation

**Hub** (Node.js 16):

```powershell
cd hub
npm install
npm run build:backend
npm run build:windows
.\scripts\test-companion-http.ps1
```

The HTTP smoke test needs a running Hub with **Companion (HTTP)** selected; stop other heartbeat senders before testing the 4-second timeout.

**Companion module** (Node.js 22.20+):

```powershell
cd companion-module-greencrew-vtally
npm install
npm run check
npm test
npm run package
```

The module's package version is **0.4.0**; the Hub has its own versioning. The module's former OBS-specific `sync_obs` action was removed; reconfigure old triggers to `sync_sources`. These are **development commands**, not a claim of completed hardware acceptance testing.

## Documentation

- [Companion module setup, source mapping and LAN security](companion-module-greencrew-vtally/README.md)
- [Companion in-app help](companion-module-greencrew-vtally/companion/HELP.md)
- [Hub Companion HTTP API and Windows smoke test](hub/COMPANION-HTTP.md)
- [D1 Mini / WS2812B 4×4 and NodeMCU firmware](tally/D1-MINI-4X4.md)

## Known limitations

- The source integration depends on Companion variables accurately reflecting the switcher's **actual** Program/Preview. A lost upstream connection can leave stale cached variables.
- The Hub watchdog detects **missing HTTP snapshots**, not every possible failure upstream of Companion.
- Native module behavior with ATEM/vMix and the ESP8266 physical hardware path is not yet end-to-end verified.
- The NodeMCU USB uploader needs native serialport bindings and external Lua application files in the packaged Windows distribution.
