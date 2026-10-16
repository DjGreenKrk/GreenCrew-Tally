# Bitfocus Companion → vTally HTTP source (MVP)

The **Companion (HTTP)** mixer source accepts Program/Preview from Bitfocus
Companion running on the same Windows computer as vTally Hub. Existing web and
ESP8266/NodeMCU tally clients need no protocol changes.

## Setup

1. Run vTally Hub and open `http://localhost:3000` (or configured port).
2. Under **Video Mixer**, select **Companion (HTTP)** and click **Save**.
3. Patch camera tallies to channels 1, 2 and 3.
4. Send HTTP snapshots from Companion, PowerShell, or another local process.

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

### PowerShell smoke test

```powershell
$uri = 'http://127.0.0.1:3000/api/companion/tally'
Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' -Body '{"programs":["1"],"previews":["2"]}'
Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' -Body '{"programs":["2"],"previews":["3"]}'
Invoke-RestMethod -Uri $uri -Method Post -ContentType 'application/json' -Body '{"programs":[],"previews":[]}'
```

### Security / limitations

- Only direct loopback clients (`127.0.0.1`, `::1`) can access the API.
  Hub and Companion must share a computer for this MVP.
- `400`: bad payload, `403`: non-local request, `409`: wrong mixer source.
- HTTP source is not an OBS WebSocket adapter. Companion must reflect **actual**
  switcher state, including changes outside Companion.
- The input has **no heartbeat or stale-state timeout yet**. A Companion crash
  may leave the last state lit until another snapshot arrives or the source is
  changed. The upcoming native module should implement heartbeat/fail-safe.
