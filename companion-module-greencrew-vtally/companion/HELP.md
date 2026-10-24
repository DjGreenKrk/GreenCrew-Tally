# GreenCrew Tally — Companion 5

Connects Bitfocus Companion to a **local or remote GC Tally Hub**. Remote LAN connections require a Hub access token.

## Setup

1. Start the updated GC Tally Hub and choose **Companion (HTTP)** as the mixer source.
2. Load this module through Companion's **Developer Modules Path**, or import a built module package.
3. Add the **GreenCrew Tally** connection in Companion. Set the Hub host/IP, port (default **3000**), camera count (1–32), and optional LAN access token.
4. Drag the ready-made Program/Preview camera presets onto buttons, or add individual actions.

The default local endpoint is `http://127.0.0.1:<port>/api/companion/tally`. A remote Hub requires an access token: on the Hub computer open **Configuration → Companion (HTTP)**, click **Allow LAN access (generate token)** and copy the token into this module (a `VTALLY_COMPANION_TOKEN` environment variable on the Hub still works and takes precedence). LAN transport is plain HTTP: use only a trusted, isolated network or secure tunnel. See the module README for setup.

For source-driven operation (OBS/ATEM/vMix), trigger **Sync Program + Preview from Companion variables** when either upstream Program or Preview variable changes, and map exact source values to camera IDs. Do not use stale feedback-derived local variables as the source of truth.

## Actions

- **Set Program camera** — selects a camera as Program (red). On the light Program > AUX > Preview.
- **Set Preview camera** — selects a camera as Preview (green).
- **Set camera on AUX** — selects a camera as AUX (orange); it is independent of Program/Preview.
- **Toggle camera on AUX** — adds or removes a camera on AUX.
- **Clear AUX** — empties the AUX list.
- **Clear one camera** — removes it from Program, Preview and AUX.
- **TAKE** — swaps the Program/Preview lists.
- **Clear all** — blanks every tally.
- **Set full snapshot** — lists of camera IDs 1–32, separated by commas (Program, Preview and optional AUX). Allows multiple cameras per list.
- **Sync Program + Preview from Companion variables** — atomically maps upstream Program/Preview (and optional AUX) source values to configured camera IDs.

## Feedback & variables

Program, Preview, AUX and Hub connection feedback use the latest **HTTP-acknowledged** state. Variables: `connected`, `programs`, `previews`, `auxes` and `cam_1` through `cam_8`.

## Heartbeat & safety

The module sends a full snapshot to the Hub every **1 second**. The Hub marks Program/Preview **UNKNOWN** if **no snapshot is received for 4 seconds** (blue operator tally warning).

**Important:** after a timeout, the real switcher's on-air camera is *unknown*, not necessarily OFF. An UNKNOWN warning is not a guarantee that the camera is off-air.

This module controls the GC Tally state. It does **not automatically observe OBS, ATEM or vMix**. If other devices/software can change the real switcher's Program/Preview, configure the corresponding Companion actions or triggers to send the actual state. Do not treat manual tally buttons as authoritative real-world on-air detection.

On module startup or a connection-config change, the initial state is empty rather than restoring a potentially stale Program camera.
