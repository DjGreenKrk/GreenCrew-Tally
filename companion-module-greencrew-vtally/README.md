# GreenCrew vTally — Bitfocus Companion 5 connection (prototype)

Local Companion module driving the vTally Hub over HTTP. Compatible with the
new `Companion (HTTP)` mixer source in this fork. **No ESP8266 needed to
test the control path:** use the Hub's existing Web Tally clients.

## Install on Windows for Companion 5.0.6

Use Node **22 or 24** for this separate module (the legacy `hub/` build
still uses Node 16). From the repo root:

```powershell
git pull --ff-only
fnm use 24.19.0
cd .\companion-module-greencrew-vtally
npm install
npm run check
npm test
npm run package
```

If `npm run package` fails, save the error log and use the existing
**Generic HTTP Requests** connection until fixed. Do not change the
legacy Hub's dependencies to fix this module.

In the Companion Launcher, click the gear (Advanced Settings), select
**Developer Modules Path** = the parent `wifi-tally` folder (the folder
CONTAINING `companion-module-greencrew-vtally`, not the module folder
itself), and enable **Developer Modules**. Restart/reload the launcher if
necessary. Under Connections, look for **GreenCrew vTally** (dev).
If the source folder is not accepted directly, import the output package
created by `npm run package` through Companion's module-import UI.

In vTally select **Companion (HTTP)** as mixer; the Hub HTTP port is 3000.
In the new Companion connection use port **3000**. The module connects to
`127.0.0.1` only (same Windows computer).

## Available functions

- Actions: Program camera, Preview camera, clear camera, TAKE,
  blackout, full Program/Preview snapshot (IDs 1–8).
- Feedbacks: confirmed Program (red), Preview (green), connection status.
- Variables: `connected`, `programs`, `previews`, `cam_1` .. `cam_8`.
- Presets: preconfigured Program/Preview buttons for cameras 1–8 and
  blackout.
- Full snapshot heartbeat every **1 second**; Hub clears a stale tally
  state when updates stop for **4 seconds**.

The module's state comes from **its own actions**, not automatically from OBS
or an ATEM. If you switch cameras outside these actions, additional
Companion integration/triggers must relay the actual mixer's new state.
Otherwise the tally does **not** faithfully reflect on-air status.

### Test without hardware

1. Start the rebuilt Hub `hub\dist\vtally.exe` and select Companion (HTTP).
2. Add three **Web Tallies** in the Hub, assign one per channel 1, 2 and 3.
3. Open their browser-based tally views and put them next to Companion.
4. Hit the preset `CAM 1 PROGRAM` and `CAM 2 PREVIEW`. Observe red/green
   in the Web Tallies and check `GET http://127.0.0.1:3000/api/companion/tally`.
5. Shut down Companion (not the Hub); after about 4 seconds the Hub should
   report `receiving:false` and the Program/Preview lists will be UNKNOWN (operator tally flashes blue).
6. Restart Companion and check recovery. Test rapid Program changes too.

**Fail-safe limitation:** signal loss means UNKNOWN physical on-air state;
the Hub displays the warning state instead of pretending the camera is OFF. Never assume a blank lamp means
it is safe to move an on-air camera.

## Development status

Prototype, not yet verified with a live Companion 5.0.6 installation or
the actual D1 Mini and WS2812B modules. The existing generic HTTP
integration remains a reliable fallback for control-path tests.
