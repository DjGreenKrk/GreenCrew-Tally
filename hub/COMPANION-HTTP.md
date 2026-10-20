# Bitfocus Companion → vTally HTTP source (MVP)

The **Companion (HTTP)** mixer source accepts Program/Preview from Bitfocus
Companion running on the Hub computer or on another computer in a trusted LAN (with a configured Hub token). Existing web and
ESP8266/NodeMCU tally clients need no protocol changes.

## Setup

1. Run vTally Hub and open `http://localhost:3000` (or configured port).
2. Under **Video Mixer**, select **Companion (HTTP)** and click **Save**.
3. Patch camera tallies to channels 1, 2 and 3.
4. Send HTTP snapshots from Companion, PowerShell, or another authorized process. For remote LAN access, configure `VTALLY_COMPANION_TOKEN` on the Hub and supply `Authorization: Bearer <token>` (see the Companion module README).

### API

- `GET http://127.0.0.1:3000/api/companion/tally` returns
  `{"active":true,"programs":["1"],"previews":["2"]}`.
- `POST http://127.0.0.1:3000/api/companion/tally` with
  `Content-Type: application/json` sets the **whole state**:
  `{"programs":["1"],"previews":["2"]}`.
- Send `{"programs":[],"previews":[]}` to clear both states (blackout).
- Always include **both arrays**. Camera IDs 1–8 are accepted, as strings
  or numbers. Multiple camera IDs are supported per array; Program has
  priority over Preview in vTally.
- Optional third array `"auxes":["3"]` marks cameras routed to an AUX output.
  Missing `auxes` means none. Priority on the light is Program > AUX > Preview.
  AUX is orange on the operator light (cyan in the Yellow-Pink scheme); the
  stage light shows it only when **Shows AUX State** is enabled.

### PowerShell smoke test

```powershell
$uri = 'http://127.0.0.1:3000/api/companion/tally'
Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' -Body '{"programs":["1"],"previews":["2"]}'
Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' -Body '{"programs":["2"],"previews":["3"]}'
Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' -Body '{"programs":["2"],"previews":["3"],"auxes":["1"]}'
Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' -Body '{"programs":[],"previews":[]}'
```

### Security / limitations

- Loopback clients (`127.0.0.1`, `::1`) can access the API without a token. Remote clients need a Hub-configured `VTALLY_COMPANION_TOKEN` of at least 16 characters and a matching Bearer token.
- LAN traffic uses unencrypted HTTP. Never expose the Hub port to the internet; use a trusted isolated LAN or secure tunnel.
- `400`: bad payload, `403`: unauthorized remote request, `409`: wrong mixer source.
- HTTP source is not an OBS WebSocket adapter. Companion must reflect **actual**
  switcher state, including changes outside Companion.
- The Hub considers Companion **receiving** only after its first HTTP POST.
  GET status includes `receiving`, `ageMs` and `timeoutMs` (4000 ms).
- Without a new snapshot for more than **4 seconds**, the Hub marks the mixer
  disconnected and propagates `UNKNOWN` (null Program/Preview), causing
  operator tallies to show the existing blue warning pattern. Do not confuse
  this with cameras actually being off-air.
- The bundled local Companion module (`../companion-module-greencrew-vtally`)
  sends complete snapshots every second and provides native actions, feedbacks,
  presets and variables. The Generic HTTP module can still be used for manual
  tests, but must send heartbeat snapshots repeatedly for long-lived states.


## Windows packaged build notes

- Build from the `hub` directory with `npm run build:windows`.
- Run `dist/vtally.exe`. Packaged builds default to **production** and
  serve the compiled `dist/frontend/` directory on port 3000; no React
  development server on port 3001 is needed.
- Previous builds that display `Serving frontend via proxy` can be started
  temporarily in PowerShell with:
  ```powershell
  $env:NODE_ENV = 'production'
  .\dist\vtally.exe
  ```
- The saved mixer selection may still be `obs`. Switch it to
  **Companion (HTTP)** in the web interface; otherwise the old OBS connector
  will continue attempting reconnects.
- If the packaged USB flasher reports missing NodeMCU/serialport dependencies or firmware assets, rebuild with Node 16 and ensure `dist/esp8266/` is present beside `dist/vtally.exe`. The Hub uploader transfers Lua application files; a new ESP8266 still requires a separately flashed base NodeMCU `.bin`. Physical flashing remains unverified.

### End-to-end smoke test without a D1 Mini

With the updated Windows Hub running and `Companion (HTTP)` selected,
**stop all other snapshot senders** so their heartbeats don't mask the timeout.
From the `hub` directory:

```powershell
.\scripts\test-companion-http.ps1
```

This verifies camera 1/2, camera 2/3, the 4-second timeout to UNKNOWN,
and recovery after a fresh POST. For the operator view, add Web Tallies
patched to channels 1–3 in the Hub.

For physical D1 Mini + WS2812B 4×4, see `../tally/D1-MINI-4X4.md`.
