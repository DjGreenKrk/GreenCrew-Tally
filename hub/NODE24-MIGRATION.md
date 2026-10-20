# Hub modernization: Node.js 24 proof of concept

Status: **exploratory**, based on `feat/companion-http-tally`. Do not merge into the Companion PR until the migration checks pass.

## Baseline and scope

The working Windows release is still built with Node.js 16 and `pkg` 5.8.1. The native Companion 5 module has its own Node 22 runtime and is not part of this migration.

The first milestone is to establish whether the **existing Hub source** installs, passes its unit tests, and compiles on Node 24. The new workflow `.github/workflows/hub-node24-probe.yml` runs on Windows and deliberately stops before EXE packaging. This avoids confusing Node 24 compatibility with the separate, unsupported `pkg --targets node16-win-x64` packaging path.

## Known migration blockers to investigate

1. **Native dependencies:** `midi`, `nodemcu-tool` and its `serialport` bindings may need rebuilds or replacement for Node 24. Verify serial port enumeration and physical upload, not only a successful `npm install`.
2. **Packaging:** `hub/scripts/package-windows.js` targets Node 16 in `pkg`. A new packaging design must preserve the external `frontend/` and `esp8266/` directories and support native addons. Compare Node SEA and maintained alternatives before choosing.
3. **Frontend:** React 17, `react-scripts` 4, Material UI 4 and TypeScript 4.4 should be migrated in a separate step after the runtime baseline. Vite may replace react-scripts, but the dev proxy and production static routes must be preserved.
4. **Protocols:** Socket.IO 2 client/server must be migrated together; OBS WebSocket 4 and 5 are not wire-compatible. Preserve ATEM/vMix behavior and Companion HTTP watchdog semantics.
5. **Tests:** Preserve Program/Preview and UNKNOWN semantics, Hub HTTP API, UDP tally distribution, Windows startup, and NodeMCU flasher behavior.

## Acceptance gates

- [ ] Node 24 clean install on Windows
- [ ] Existing Hub unit tests on Node 24
- [ ] Backend and frontend build on Node 24
- [ ] Packaged Windows executable runs without Node installed
- [ ] HTTP Companion snapshot, heartbeat, timeout/UNKNOWN and recovery
- [ ] UDP and Web Tally updates
- [ ] Native serial port enumeration in packaged executable
- [ ] Physical ESP8266 NodeMCU Lua upload, settings write and reboot
- [ ] Existing OBS/ATEM/vMix integrations regression-tested

## Rollback

Keep `feat/companion-http-tally` unchanged as the working baseline. The migration branch is experimental. A failed compatibility probe is an expected diagnostic result, not grounds to suppress the job or weaken the acceptance gates.

## Node 24 probe result — 2026-10-16

GitHub Actions run [38933024577](https://github.com/DjGreenKrk/GreenCrew-Tally/actions/runs/38933024577/job/117081477811) completed with a frontend build failure on Node.js 24.21.0:

- `npm ci --legacy-peer-deps --foreground-scripts`: passed.
- Hub unit tests: 30 suites passed, 276 tests passed, 1 skipped.
- `npm run build:backend`: passed.
- `npm run build:frontend`: failed with `ERR_OSSL_EVP_UNSUPPORTED` in `webpack/lib/util/createHash.js` from the `react-scripts@4` toolchain.

**Conclusion:** the first confirmed blocker is the old Webpack 4 / OpenSSL hashing path, not backend TypeScript compilation. Do not permanently enable `--openssl-legacy-provider` merely to make CI green. Migrate the frontend bundler (preferably Vite), then rerun the same probe. Successful npm install does **not** prove native serialport upload or Windows EXE packaging on Node 24.
