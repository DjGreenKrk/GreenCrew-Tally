# Modernization status — vTally PR #2

Date: 2026-10-16. Starting HEAD: ff34a9f75d333ccc43287bcebb24597f24bba025. Historical audit SHA: 7a4888126b32df1d11155bb5bed31356139aa51d.

**NOT COMPLETE**. Historical successful CI means build/unit/smoke only, not functional new-stack acceptance. Never touch PR #1, merge or release for this task.

## Stages
| ID | Status | Next acceptance |
|---|---|---|
| E0 | In progress | Contracts inventoried below; repeat 276 pass + 1 skip baseline on modern stack |
| E1 | In progress | Isolated Node24 compiler/lint/test/ESM/native/EXE probes in separate diagnostic CI; analyze recorded outcomes |
| E2 | Not started | Clean TS/Jest/lint/typecheck |
| E3 | Not started | Modern browser code, production JS in Chromium |
| E4 | Not started | Live Hub HTTP → Socket.IO and UDP, timeout and recovery |
| E5 | Not started | NodeMCU serialport, MIDI, firmware and recovery |
| E6 | Not started | Exact published Windows ZIP, isolated EXE and tray |
| E7 | Not started | Final CI, package audit, Companion host-compatible runtime |
| E8 | Not started | Physical and release sign-off |

## E0 contracts from source (preserve exactly)
- Integrations: MixerDriver ATEM, OBS, vMix, Roland V8HD, Roland V60HD, Companion HTTP; Null, Mock (dev), Test (test).
- Companion POST /api/companion/tally expects programs/previews arrays of unique channel strings 1..8, max 8. 400 invalid, 409 inactive. Loopback allowed, remote Bearer token of at least 16 characters; never trust X-Forwarded-For. GET exposes active, receiving, ageMs, timeoutMs and current state. CompanionApi.spec.ts.
- CompanionConnector TIMEOUT_MS=4000 with watchdog 250ms. Identical snapshots refresh heartbeat while suppressing redundant program.changed; timeout publishes null/null (= UNKNOWN), *not* []/[] (= known empty); next snapshot reconnects. CompanionConnector.spec.ts.
- Web Tally: events.webTally.subscribe/unsubscribe, webTally.state, webTally.invalid; mixer.state, program.state, tally.state. CommandCreator state order highlight → unknown → on-air → preview → release. Cypress webtally.spec.ts, CommandCreator.spec.ts.
- UDP default port 7411; inbound tally-ho "name", log "name" LEVEL "text". Outgoing Oxxx/xxx/xxx Sxxx/xxx/xxx plus optional blink. UNKNOWN flash 0x80 250. MISSING/DISCONNECTED timers and keepalives configurable. CommandParser.spec.ts, CommandCreator.spec.ts. No live-port acceptance yet.
- Config: CONFIG_FILE override, default ~/.wifi-tally.json; AppConfiguration.toJson/fromJson stores mixer, per-mixer settings, tallyDefaults, tallies, channels and vmixProjects. Existing fixtures settings-v0.2.1.json, -v0.3.0.json, -v0.4.0.json and AppConfigurationPersistence.spec.ts. All future tests MUST use temporary directories, never a user's file.
- vMix projects: vmixProjects key = lowercase preset path; project change restores saved assignments or clears assignments, save captures current tallies, vmix.project.state emits flags. VmixProjectManager.spec.ts.
- ESP8266: init.lua + seven my-*.lua/.lc modules (my-app, my-led, my-log-buffer, my-log, my-settings, my-tally, my-wifi); preserve tally-settings.ini, file upload, read-back, hard reset. FirmwareAssets.spec.ts does not validate physical upload.
- Tray: portable wrapper must start hub, open browser, Exit, dispose child; currently no isolated test.

## Known baseline defects (NOT regressions introduced by modernization)
Production UI imports Node events via ObsSettings → ObsConnector → obs-websocket-js; browser runtime failure in jsdom. React-full-screen prerelease React16 peer conflicts with React17, npm ci without legacy-peers fails. @yao-pkg/pkg not recorded in lockfile; experimental artifact omits frontend and does not prove native addon load inside EXE. NodeMcuConnector.hardReset throws from timer and spins indefinitely; vMix reconnect limit process.exit(1). Old Windows smoke uses Node16/CRA. No verified Chromium production UI, real serial hardware or end-to-end UDP.

## Provisional version matrix (not an installed/approved stack)
Hub Node24 LTS; TS6 + typescript-eslint8 + ESLint10 (compare against TS7 peer constraint); React19 / Router7 / MUI9; Vite8, Jest30, Cypress16; Express5, Socket.IO4, OBS5, ATEM3.10; serialport13 / midi2; @yao-pkg/pkg6 / Electron44 / builder26. Companion separate Node22-compatible line. Registry metadata fetched in E1, then finalize exact versions after peer/engine/build/acceptance checks. No exceptions approved yet: each older version needs evidence and a retest trigger.

## Execution evidence
- 2026-10-16 GitHub API inspected PR, starting HEAD, source, fixtures, plan, audit and workflows. No AGENTS.md at root or hub; .github/agents/enter.agent.md is a placeholder.
- Historical baseline: [Windows Node24: 276 pass, one skip](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38963934872). At starting HEAD: [quality gate](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38970056259) and [HTTP-only frontend smoke](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38970056362) successful; [Windows EXE smoke](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38970056403) initially in progress. These do NOT verify target stack or installed Windows ZIP.
- E1 isolated diagnostic command: node hub/scripts/modernization-e1-probe.cjs, Windows 2022 / Node24 in CI. It saves JSON in hub/dist/e1-probe. Results pending; a zero probe exit does NOT mean a passed compatibility gate.
- Local container: Linux Node22.16.0, npm10.9.2; outgoing Github DNS blocked; cannot run Node24/npm installation locally. CI is required for verified new-stack results.
- Update this log on every stage with exact versions, commands, OS, commit SHA and CI run links.

## Physical acceptance: NOT TESTED
ESP8266 real COM enumeration, 8 Lua files upload/readback, ini, reset, rediscovery and live tally; Roland MIDI real interface enumeration and messages; hardware OBS/ATEM/vMix/Roland state/disconnection; unpack the *published* Windows ZIP on machine without Node and test EXE native addons, frontend Chromium, Web/UDP and tray shutdown. Record model, software, image SHA, command, result. Mocks are not hardware tests.
