# GreenCrew Tally Companion 5 module

Companion module for the GC Tally Hub `Companion (HTTP)` mixer connector.
Communication with the Hub uses HTTP on localhost or an authenticated LAN IP;
no direct OBS, ATEM, or vMix dependency is required. Hub forwards tally state to the
configured Web/UDP tally clients.

## Version 0.5.0

Adds the AUX tally state (see **AUX tally** below).

## Version 0.4.0

The old OBS-specific `sync_obs` action is intentionally **removed**.
There is no compatibility layer. Existing triggers using that action must be
reconfigured with the new `sync_sources` action.

## Connection setup

Create/edit the **GreenCrew Tally** connection in Companion:

- **Hub IP address or hostname**: `127.0.0.1` for the same computer, or the LAN IP of a remote Hub.
- **Hub HTTP port**: normally `3000`.
- **Hub access token**: leave empty for localhost, provide the Hub's token for LAN operation.
- **Number of cameras**: integer from **1 to 8**, default **3**.

Changing the number of cameras immediately rebuilds all action dropdowns,
the source-mapping fields, feedback choices, module camera variables, and
Program/Preview/AUX presets. For example, a 2-camera setup has only CAM 1 and
CAM 2 throughout. Changing connection settings clears remembered tally states,
preventing stale mappings from being carried into a different show configuration.

The actual Web/UDP Tally-to-camera channel patch is configured separately in
the GC Tally Hub, as before.

## Universal Program + Preview synchronization

For one source mixer, create a single Companion trigger that runs when the
**current Program OR current Preview variable** changes. Leave conditions
empty. Add one action:

**GreenCrew Tally → Sync Program + Preview from Companion variables**

Configure its two variable-valued fields from the source Companion connection
(using the Companion variable selector, not feedback-derived Local Variables):

- **Program source variable**: current PROGRAM scene/input name or number.
- **Preview source variable**: current PREVIEW scene/input name or number.
- **AUX source variable** (optional): source routed to an AUX output; empty means no AUX camera.

Then configure one mapping field for each camera:

| Camera | Example from OBS | Example from ATEM or vMix |
| --- | --- | --- |
| CAM 1 | `Scena` | `5` |
| CAM 2 | `Scena 2` | `7` |
| CAM 3 | `Scena 3` | `9` |

The numbers/names must match the values returned by the source module exactly.
There is no OBS-specific logic; the same action handles any source exposing
suitable Companion variables, including ATEM/vMix. Whether a mixer's reported
PGM/PVW is the *final* output of a multi-device setup is a separate routing
decision.

**Example: OBS Studio Mode** (assuming connection ID `obs_local_2`):

- Program variable: `$(obs_local_2:scene_active)`
- Preview variable: `$(obs_local_2:scene_preview)`
- Camera mapping: scene names matching OBS exactly
- Events: `On variable change` of both of those variables

Program and Preview are resolved into **one atomic snapshot**. Do not combine
several independent Program/Preview triggers or feedback-derived local
expressions: the latter were observed to report stale values in Companion
during rapid scene switches.

The module also offers direct manual Program, Preview, AUX, clear, TAKE and blackout
actions, a full camera-ID snapshot action, confirmed-state feedbacks, and presets.
They honor the connection's configured camera count.

## Transport and safety

The module sends a full snapshot on any requested state update and every
**1 second** as heartbeat. The Hub's **4-second** watchdog reports UNKNOWN if
snapshots stop arriving; it must not report a camera as safely OFF when the
state is unknown. Unknown source names, duplicate mapping values and invalid
camera IDs are errors; automatic source synchronization pauses heartbeat
instead of pretending the camera is off-air.

When the exact upstream connection state is lost but its variables remain
cached, Companion may not fire another variable-change event. Monitor the
upstream connection status separately for show-critical deployments.

## Development and packaging

This module uses Node **22.20+**; the Hub uses Node 24.

```powershell
cd companion-module-greencrew-vtally
npm install
npm run check
npm test
npm run package
```

The latest greencrew-vtally Companion artifact is also built in GitHub Actions
on the `feat/companion-http-tally` branch. Import the `.tgz` inside the artifact
ZIP into Companion, then verify the module version is **0.5.0**.

For a basic test, set the Hub mixer to **Companion (HTTP)**, create several
Web Tallies with matching numbered channels, switch your source mixer, and
inspect `GET http://127.0.0.1:3000/api/companion/tally`.

This implementation has been tested with OBS via Companion and Web Tally.
Hardware ESP/WS2812B, ATEM, and vMix have not yet been verified end-to-end.

## Hub on a different computer (LAN)

**Both the Hub EXE and Companion module must be updated** for a remote setup.
The original Hub accepts Companion snapshots from localhost only. Version 0.4.0
of the Companion module adds the configurable IP field, but LAN authorization
also requires rebuilding the Hub from this branch.

On the **Hub computer**, open PowerShell, generate a random 32-byte token and
start the rebuilt Hub with that token:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$token = [BitConverter]::ToString($bytes).Replace('-', '')
$env:VTALLY_COMPANION_TOKEN = $token
Write-Host "Copy this token to Companion: $token"
.\hub\dist\gc-tally.exe
```

Use the correct path to `gc-tally.exe` for the current directory. The token must
be available as the `VTALLY_COMPANION_TOKEN` environment variable of the Hub
process **every time it starts**. If launched from a shortcut, configure that
variable in the launching environment; simply saving a token in Companion is not
enough. The Hub requires at least 16 characters for remote authorization.
Only localhost is accepted when no Hub token is configured.

On the **Companion computer**, enter the Hub's LAN IP, port (default 3000), and
the same token in the GreenCrew Tally connection settings. Do not enter
`http://` or `:3000` inside the IP field. The Hub must be reachable on TCP
port 3000; Windows Firewall may require an inbound rule for the *trusted*
event-production LAN.

The token is transmitted over ordinary HTTP. **Do not expose the Hub port
to the internet or use this across an untrusted network.** Use a trusted,
isolated LAN or a secure network tunnel. Do not share or commit tokens.

Test from the Companion computer:

```powershell
$headers = @{ Authorization = 'Bearer YOUR_HUB_TOKEN' }
Invoke-RestMethod -Uri 'http://HUB_IP:3000/api/companion/tally' -Headers $headers
```

Note that merely opening the Hub GUI in a browser on a different computer
does not change where the Companion module runs: the configured Hub address
must point to the machine running the Hub backend.

## Windows firmware distribution (ESP8266)

The Windows release ZIP (`gc-tally-windows-*.zip`) contains everything for a
setup from scratch: `gc-tally.exe` with the tally application in `esp8266\`,
`flash-nodemcu.cmd` with esptool and the base NodeMCU image for a new
ESP8266, this module as a `.tgz`, and `START-TUTAJ.txt` with the steps.

## AUX tally

AUX (orange) marks a camera routed to an AUX output. It is an independent bus:
setting Program or Preview does not change it. On the light, priority is
Program > AUX > Preview. Actions: **Set camera on AUX**, **Toggle camera on AUX**
and **Clear AUX**; the snapshot and source-sync actions have an optional AUX
field (empty = none), so existing buttons keep working. The module sends
`auxes` with every snapshot; the Hub must support it (older Hubs ignore it).
