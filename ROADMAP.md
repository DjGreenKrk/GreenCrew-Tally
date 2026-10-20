# GC Tally roadmap

Work deliberately left out of GC Tally 0.6.0 (PR #2). The original modernization plan
(`hub/MODERNIZATION-IMPLEMENTATION-PLAN.md`) required every upgrade below before anything
could be merged; it was rescoped on 2026-10-20 so that the verified, working parts ship
first. Each item is a separate change, taken on when it brings a real benefit, and has a
[GitHub issue](https://github.com/DjGreenKrk/GreenCrew-Tally/issues) for discussion.

## Functional

| Item | Why | Notes |
| --- | --- | --- |
| **OBS WebSocket v5** (#3) | OBS 28+ only speaks protocol v5; the direct OBS connector still uses v4 (`obs-websocket-js` 4) | OBS via Companion works today. Needs a v5 test server/fixtures |
| vMix: manual reconnect (#4) | After 10 minutes of retries the connector stays disconnected until the Hub restarts or the mixer is re-selected | A "Reconnect" button in the mixer settings |
| Base NodeMCU flash from the Hub (#5) | Today a new ESP8266 needs `flash-nodemcu.cmd` once | Would need a bundled esptool-compatible flasher in the EXE |
| Tray app (#6) | `npm run build:tray` (Electron 22 → 44) is not built or tested | Start Hub, open browser, Exit, no orphan process |

## Dependency upgrades

| Item | Current → target | Notes |
| --- | --- | --- |
| React / Router / MUI (#8) | 17 / 5 / 4 → 19 / 7 / 9 | Rewrites most of the UI; no user-visible gain by itself |
| Express / Socket.IO / proxy (#9) | 4 / 2 / 1 → 5 / 4 / 4 | Client and server together; the HTTP, Socket.IO and UDP integration test guards it |
| Cypress (#10) | 6 → 16 | The `hub/cypress` scenarios do not run in CI at the moment |
| serialport / NodeMCU transport / MIDI (#11) | 8 / `wifi-tally/NodeMCU-Tool` fork / 1 → 13 / maintained transport / 2 | The flasher is verified on hardware with the current stack; keep that test when replacing it |
| ATEM, xml2js, yargs (#12) | nightly 3.0 → stable 3.x, 0.4 → 0.6, 15 → current | Unused `forever-monitor` can be removed |

## Not yet verified on real equipment (#13)

- ATEM, vMix and Roland V-8HD / V-60HD connected directly to the Hub; Roland MIDI interfaces.
- Importing the Companion module into a running Companion 5; AUX colour on a physical light.
- A full `flash-nodemcu.cmd` run on a new board (the same esptool steps were done by hand).
- Behaviour of a tally during long Wi-Fi outages and on battery power.
