# GreenCrew vTally Companion 5 module

Companion module for the vTally Hub `Companion (HTTP)` mixer connector.
All communication with the Hub is loopback HTTP on the same machine; no direct
OBS, ATEM, or vMix dependency is required. Hub forwards tally state to the
configured Web/UDP tally clients.

## Version 0.3.0 (breaking configuration change)

The old OBS-specific `sync_obs` action is intentionally **removed**.
There is no compatibility layer. Existing triggers using that action must be
reconfigured with the new `sync_sources` action.

## Connection setup

Create/edit the **GreenCrew vTally** connection in Companion:

- **Local Hub HTTP port**: normally `3000`.
- **Number of cameras**: integer from **1 to 8**, default **3**.

Changing the number of cameras immediately rebuilds all action dropdowns,
the source-mapping fields, feedback choices, module camera variables, and
Program/Preview presets. For example, a 2-camera setup has only CAM 1 and
CAM 2 throughout. Changing connection settings clears remembered tally states,
preventing stale mappings from being carried into a different show configuration.

The actual Web/UDP Tally-to-camera channel patch is configured separately in
the vTally Hub, as before.

## Universal Program + Preview synchronization

For one source mixer, create a single Companion trigger that runs when the
**current Program OR current Preview variable** changes. Leave conditions
empty. Add one action:

**GreenCrew vTally → Sync Program + Preview from Companion variables**

Configure its two variable-valued fields from the source Companion connection
(using the Companion variable selector, not feedback-derived Local Variables):

- **Program source variable**: current PROGRAM scene/input name or number.
- **Preview source variable**: current PREVIEW scene/input name or number.

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

The module also offers direct manual Program, Preview, clear, TAKE and blackout
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

This module uses Node **22.20+**; the older Hub build uses Node 16.

```powershell
cd companion-module-greencrew-vtally
npm install
npm run check
npm test
npm run package
```

The latest greencrew-vtally Companion artifact is also built in GitHub Actions
on the `feat/companion-http-tally` branch. Import the `.tgz` inside the artifact
ZIP into Companion, then verify the module version is **0.3.0**.

For a basic test, set the Hub mixer to **Companion (HTTP)**, create several
Web Tallies with matching numbered channels, switch your source mixer, and
inspect `GET http://127.0.0.1:3000/api/companion/tally`.

This implementation has been tested with OBS via Companion and Web Tally.
Hardware ESP/WS2812B, ATEM, and vMix have not yet been verified end-to-end.
