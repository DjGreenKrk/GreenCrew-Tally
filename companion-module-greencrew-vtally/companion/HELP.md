# GreenCrew vTally — Companion 5

Connects Bitfocus Companion to a **vTally Hub on the same computer**.

## Setup

1. Start the updated vTally Hub and choose **Companion (HTTP)** as the mixer source.
2. Load this module through Companion's **Developer Modules Path**, or import a built module package.
3. Add the **GreenCrew vTally** connection in Companion. Hub port defaults to **3000**.
4. Drag the ready-made Program/Preview camera presets onto buttons, or add individual actions.

This module connects to `http://127.0.0.1:<port>/api/companion/tally`; remote HTTP clients are intentionally denied by the Hub.

## Actions

- **Set Program camera** — selects a camera as Program (red).
- **Set Preview camera** — selects a camera as Preview (green).
- **Clear one camera** — removes it from both lists.
- **TAKE** — swaps the Program/Preview lists.
- **Clear all** — blanks every tally.
- **Set full snapshot** — lists of camera IDs 1–8, separated by commas. Allows multiple Program/Preview cameras.

## Feedback & variables

Program, Preview and Hub connection feedback use the latest **HTTP-acknowledged** state. Variables: `connected`, `programs`, `previews` and `cam_1` through `cam_8`.

## Heartbeat & safety

The module sends a full snapshot to the Hub every **1 second**. The Hub clears the state if **no snapshot is received for 4 seconds**.

**Important:** after a timeout, the real switcher's on-air camera is *unknown*, not necessarily OFF. A dark tally is not a guarantee that the camera is off-air.

This module controls the vTally state. It does **not automatically observe OBS, ATEM or vMix**. If other devices/software can change the real switcher's Program/Preview, configure the corresponding Companion actions or triggers to send the actual state. Do not treat manual tally buttons as authoritative real-world on-air detection.

On module startup or a connection-config change, the initial state is empty rather than restoring a potentially stale Program camera.
