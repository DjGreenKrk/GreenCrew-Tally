# Modernization status — vTally PR #2

Date: 2026-10-16. Starting HEAD: ff34a9f75d333ccc43287bcebb24597f24bba025. Historical audit SHA: 7a4888126b32df1d11155bb5bed31356139aa51d.

**NOT COMPLETE**. Historical successful CI means build/unit/smoke only, not functional new-stack acceptance. Never touch PR #1, merge or release for this task.

## Stages
| ID | Status | Next acceptance |
|---|---|---|
| E0 | Completed (contract baseline) | Contract inventory, updated PR description, 32 suites / 280 pass / 1 skip on current baseline; final modern-stack replay still required in E8 |
| E1 | Completed as feasibility/decision stage; distribution remains blocked in E6 | Node24/TS6/lint/Jest/native probes performed; pkg native snapshot and dynamic import failed; ADR selects Node SEA, not yet implemented |
| E2 | Partial | Commit 0679e13: Node24/types24 + TypeScript6, clean npm ci with no peer bypass, compiler + baseline tests; ESLint10/Jest30/Cypress16 and full test typecheck open |
| E3 | Partial | Removed direct runtime mixer imports from browser and added Chromium production-render gate; React/router/MUI migrations still open |
| E4 | Partial | Live Hub Companion HTTP → Socket.IO/Web Tally and UDP with heartbeat, timeout, UNKNOWN and recovery passed in CI 38974020564; Express5, Socket.IO4, OBS5 and remaining protocol migrations open |
| E5 | Partial | Bounded NodeMCU hard reset mock and no Hub exit on vMix lost source; native EXE and physical tests open |
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


## E0 acceptance evidence and partial E1–E5 implementation, 2026-10-16

**Actual committed work** (PR #2 branch; no merge/release):

| SHA | Change | Verification |
|---|---|---|
| [80fa257](https://github.com/DjGreenKrk/wifi-tally/commit/80fa257dda3f6e15a7bfb654f62b1327f4042a0f) | E0 contracts + E1 isolated CI | Original diagnostic incorrectly spawned npm.cmd; untrusted until fixed |
| [ef00444](https://github.com/DjGreenKrk/wifi-tally/commit/ef00444bab9a9d275b0b676285b3e11aed71b2f2) | Node24 Windows cmd.exe npm launch | [E1 report](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38971757398) |
| [a02c850](https://github.com/DjGreenKrk/wifi-tally/commit/a02c850ff33c7073849e2dbaa533e12763945faf) | bounded NodeMCU hard reset, no process.exit on vMix outage, mocks | [Quality gate](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38971946212) |
| [5438eda](https://github.com/DjGreenKrk/wifi-tally/commit/5438eda6d372ce9aec3decd173402caf129cbfae) | browser-safe mixer IDs, OBS UI no longer imports backend, useEffect | [Vite browser gate](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972441478) |
| [53b0cb3](https://github.com/DjGreenKrk/wifi-tally/commit/53b0cb389f4e4baf3051f3d1082b69692756e1c6) | corrected E1 TSX and ESM native fixture | [Repeat E1](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972370924) |
| [9712934](https://github.com/DjGreenKrk/wifi-tally/commit/9712934cb2ac04de99bce28df5409c110541874e) | Chrome production-bundle runner | Chrome 155 on Ubuntu24.04; /, /config, /flasher, /tally/demo rendered, [CI](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972441478) |
| [f004e67](https://github.com/DjGreenKrk/wifi-tally/commit/f004e67a9705c98289069bf516821905b2ad572a) | real disconnect/reconnect indicators + test | Ubuntu24.04 Node24 [32 suites, 280 PASS, 1 SKIP](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972509434) |
| [42f449e](https://github.com/DjGreenKrk/wifi-tally/commit/42f449e40ab435f48d440f6387ba37c3d1f3112f) | actual Hub process end-to-end test | [PASS](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972670746): 4 program events, 4 WebTally events, 62 UDP frames, heartbeat, UNKNOWN, recovery |
| [5e38ab4](https://github.com/DjGreenKrk/wifi-tally/commit/5e38ab4212bd17697e870f2f9ed1921b85a9ecec) | disconnect subscription leak fix + test | [quality](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972884569) |
| [25b2266](https://github.com/DjGreenKrk/wifi-tally/commit/25b2266f81919058a032ec4eb4d8e0b6ab5aa348) | E1 isolated native-only EXE vs esbuild ESM fallback | [CI](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972999732); pending detailed verdict |
| [48808d0](https://github.com/DjGreenKrk/wifi-tally/commit/48808d076e10a406fb108e76dace4f45b7eb8a40) | transpiled browser dependency graph guard in quality gate | [quality](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38973233736) |
| [2c09383](https://github.com/DjGreenKrk/wifi-tally/commit/2c09383dbf55795d173096d00eb9140685b6982b) | strict no-bypass lockfile experiment with TS6/@types/node24 | [CI](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38973293441), pending |

**Observed Windows E1 Node 24.21.0:** \`npm view\` queried live npm registry; TypeScript7.0.2 + typescript-eslint8.71.2 had a **verified ERESOLVE**: typescript-eslint peers TypeScript >=4.8.4 <6.1.0. Choosing TypeScript 6.x is justified until the official parser's peer range permits 7. No override/force is acceptable. Latest packages observed: ESLint10.13.0, Vite8.3.4, Jest30.5.2, Express5.3.0, Socket.IO4.8.4, OBS websocket5.0.8, serialport13.0.0, midi2.0.0, @yao-pkg/pkg6.23.0, react-full-screen1.1.1.

Isolated \`npm install\` TS6+ESLint10+Jest30 worked without bypass flags (with npm *warnings* about overridden transitive peers); flat ESLint and Jest TS/Babel passed. An initial TSX probe lacked React typings, and second run failed due TypeScript6 deprecated \`moduleResolution=node\` default. E1 follow-up sets \`moduleResolution=nodenext\`; production TS compile remains unverified.

Serialport13 and MIDI2 loaded **outside** EXE on Windows Node24.21; serialport listed COM2, MIDI listed 0 ports (no physical device), \`escape-string-regexp\` ESM import succeeded. @yao-pkg/pkg6.23 produced an EXE with Node24.20 runtime; launching isolated EXE with \`import()\` resulted in \`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING\`. This is a concrete packager limitation; no successful native enumeration **inside** EXE yet. E1 follow-up independently packages native-only and bundled ESM inputs, then a packager/bundling decision must be recorded.

**Clean peer-dependency installation still blocked:** initial [strict lockfile attempt](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38973107883) failed ERESOLVE on \`@types/node@12\` vs Vite6.4.4 peerOptional \`^18 || ^20 || >=22\`, even after fixing react-full-screen peer. Follow-up proposes TypeScript6 and Node24 typings, does NOT force or bypass peers; proposed manifest+lockfile must be reviewed together and committed atomically only after CI acceptance.

**Commands/environments:** Chrome test: \`npm ci --legacy-peer-deps --ignore-scripts; npm run build:frontend; node scripts/check-production-browser.cjs\` on Ubuntu24.04/Node24/Chrome155; no hardware. Live Hub: \`npm ci --legacy-peer-deps --ignore-scripts; npm run build:backend; node scripts/check-live-companion-integration.cjs\` on Ubuntu24.04/Node24. Node24 native tests: \`node hub/scripts/modernization-e1-probe.cjs\` on Windows-2022/Node24.21. npm registry queries used \`npm view <package>@latest version engines peerDependencies --json\`. All old-stack \`--legacy-peer-deps\` here are baseline-only, **not final acceptance**.

**Known blockers after E0:** no committed clean modern manifest+lockfile; current React17/Router5/MUI4 and legacy OBS4 + Socket.IO2 remain; no isolated published Windows EXE native enumerations, no physical ESP/MIDI or mixer tests. Some current legacy workflows rely on Node16/CRA and fail or remain incomplete. Do not call E2–E8 finished.


## Update: strict dependency and CI baseline, 2026-10-16

- **Committed** [0679e13](https://github.com/DjGreenKrk/wifi-tally/commit/0679e13ef0f056444440353e99a2acae42c62d29): \`hub/package.json\` and \`hub/package-lock.json\` modified together; Node \`^24\`, TypeScript \`6.0.3\`, \`@types/node@^24\`, \`react-full-screen@1.1.1\`, \`@yao-pkg/pkg@6.23.0\`; \`pkg@5.8.1\` removed. Repro [CI](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38973778941) Ubuntu 24.04/Node 24: \`npm install --package-lock-only --ignore-scripts --no-audit --no-fund\`, \`npm ci --ignore-scripts --no-audit --no-fund\`, \`npm ls --depth=0\`, \`npx tsc --project tsconfig.json --noEmit\`, \`npm run build:backend\`, \`npm run build:frontend\`, \`npm run test:ci\`, \`node scripts/check-production-browser.cjs\`. All passed: **33 suites / 281 pass / 1 skip** confirmed in the GitHub Actions log. None used \`--force\` or \`--legacy-peer-deps\`.
- [1d2e78f](https://github.com/DjGreenKrk/wifi-tally/commit/1d2e78fb5f959cb405fcd53d89fc66e3425fe517): application/server/test TypeScript configurations separated; Node16 resolution for CommonJS backend, Bundler for UI, explicit rootDir. [71b3577](https://github.com/DjGreenKrk/wifi-tally/commit/71b3577928ac94b5be12b1bbf73ec88c58fead42): moved static defaults before initializers to support TypeScript 6 actual checking.
- [93044a8](https://github.com/DjGreenKrk/wifi-tally/commit/93044a8e7cf5db6cc4b9c49274d2badbb5f9aa6a): ordinary CI, Node24 native Windows and E2E diagnostic workflows now use \`npm ci\` without \`--legacy-peer-deps\`; obsolete Node16/CRA in Windows smoke replaced with Node24/Jest. [Quality gate](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38974020348), [real browser](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38974020425) and [live Hub](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38974020564) passed.
- E1 Windows 2022/Node 24.21 [results](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972999732): Node24 TS6 TSX, ESLint10 flat, Jest30 Babel, ESM \`import()\` in ordinary Node, serialport13 and MIDI2 outside EXE passed. Native-only and esbuild-to-CJS isolated \`@yao-pkg/pkg\` executables **failed** to load \`@serialport/bindings-cpp\` (no native build found inside snapshot); direct dynamic import inside snapshot failed separately (\`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING\`). E1 [targeted test](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38974191864) uses manufacturer's documented explicit \`.node\` assets; until success, do NOT call Windows packaging accepted.
- **Not upgraded yet:** React17/Router5/MUI4, Express4/Socket.IO2/OBS4, serialport8 fork, MIDI1, Jest29/Cypress6, Electron22, full lint stack. Their presence is **unfinished migration, not an approved legacy-version exception**. Avoid presenting green CI as modernization completion.
- **Status E2 remains PARTIAL**; clean peer installation is a confirmed milestone, but code/framework APIs and Windows distribution require E3-E8. Physical ESP, MIDI and mixers still NOT TESTED.


## Packaging decision E1 (2026-10-16)

[Historyczna decyzja E1 — **SKORYGOWANA 2026-10-17**] Pierwotny FAIL 38974191864 był niekonkluzywny, bo eksperyment nie przekazywał `--config package.json`. Poprawiona próba i wynik decyzji są zapisane w dodatku poniżej.

## Status reconciliation — 2026-10-17

Rechecked the PR #2 description, implementation plan, audit, package manifest and prior CI evidence. Updated the stage table to reflect the already documented E1 packager decision and E4 live Hub integration pass, without claiming their later implementation stages are complete. E1's native Windows EXE experiment remains failed; Node SEA is a **proposed architecture**, not a verified deliverable. E4's passing test uses the old Express/Socket.IO/OBS stack, so the new API migration is still open. No new Node24 build, package installation, hardware test, Windows EXE or CI run was executed during this reconciliation; environment has no outbound GitHub DNS or Windows runner. Source of results: https://github.com/DjGreenKrk/wifi-tally/actions/runs/38974020564 and https://github.com/DjGreenKrk/wifi-tally/actions/runs/38974191864 . No release or merge.

## Partia 2026-10-17 — E1/E4/E5, wyniki bieżących kontroli

| SHA | Zmiana | Dowód / środowisko |
|---|---|---|
| [f625cc6](https://github.com/DjGreenKrk/wifi-tally/commit/f625cc6caafd10a2f19bbba9e2d7f95630f7b850) | `pkg --config package.json`, jawne assety serialport/MIDI; izolowany E1 EXE i produkcyjny pkg | [E1 39013097025 PASS](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39013097025), Windows 2022 Node24, `node hub/scripts/check-pkg-native-assets.cjs`; [Windows smoke 39013099542 PASS](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39013099542), Windows 2022 Node24, `npm ci --foreground-scripts; npm run test:ci; npm run build:windows`. Test EXE w E1 **poza repo**, pełnego ZIP jeszcze nie. |
| [5bdf613](https://github.com/DjGreenKrk/wifi-tally/commit/5bdf613f5b7e2c0a3be81c6975c69c663e8076fa) | E4 ścisłe payloady UDP po checkpointach Program/Preview/timeout/recovery, asercje WebTally/heartbeat i negatywne testy stałego UNKNOWN oraz błędnych ramek | [Live Hub 39013668293 PASS](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39013668293), Ubuntu24.04 Node24: `node scripts/udp-phase-assertions.test.cjs; npm run build:backend; node scripts/check-live-companion-integration.cjs`. Ostatni test: 4 program events, 4 WebTally, 63 UDP. |
| [6ddc4d4](https://github.com/DjGreenKrk/wifi-tally/commit/6ddc4d4d69a49d937e59c112698cedf5814df15b) i [34e731f](https://github.com/DjGreenKrk/wifi-tally/commit/34e731f27fd93b275a349b102ad6efdfb0be9235) | E5 mutex utrzymany przez spóźnioną operację natywną aż do disconnect; test spóźnionego sukcesu, retry, braku nakładania połączeń i zamkniętego portu; ustabilizowany mock firmware | [Quality 39013670834 PASS](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39013670834), Ubuntu24.04 Node24: `npm ci --ignore-scripts; npm run test:ci`: **33/33 suites, 283 passed, 1 skipped**. To test **symulowanego transportu**, nie sprzętu. |
| [a63a69a](https://github.com/DjGreenKrk/wifi-tally/commit/a63a69af0e07c0011999960a9ace52a34a6b1429) | Korekta równoległej regresji lockfile z d8972ae, zachowano równoległy manifest, odtworzono pełne drzewo npm | [Quality 39013670834 PASS](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39013670834) po wcześniejszym `npm ci` EUSAGE brakujących pakietów. |

**E1 native EXE PASS — zmiana decyzji:** porzucono interpretację próby 38974191864 jako dowodu nieskuteczności `pkg.assets`. Ograniczony wariant SEA nie jest obecnie uzasadniony samą obsługą natywnych dodatków; `@yao-pkg/pkg` pozostaje aktywnym kandydatem do E6. [Poprawiony ADR](MODERNIZATION-E1-PACKAGING-DECISION.md).

**Nadal NIE zakończone:** E2 (`tsc --project tsconfig.test.json --noEmit`, docelowy ESLint/Jest), E3 (React19/Router7/MUI9 i interakcje), E4 (Express5/Socket.IO4/OBS5), E5 (Serialport13/MIDI2 w faktycznym Hubie i sprzęt), E6/E8 (fizyczny odbiór Windows ZIP/USB/mikser), E7. Nie interpretować zielonego CI jako ukończenia migracji API.

## E2 execution and isolation validation — 2026-10-17 (second update)

### Actually migrated tools/dependencies

- [c241433](https://github.com/DjGreenKrk/wifi-tally/commit/c2414335178e67f023a0321d7517a1cb5244fde3): Jest remains **29.7.0**, upgraded `@types/jest` 26 → **29.5.14**. Added/pinned **eslint 10.13.0**, **@eslint/js 10.0.1**, **typescript-eslint 8.71.2** (TypeScript **6.0.3** compatible), **eslint-plugin-react-hooks 7.1.1**, **eslint-plugin-cypress 7.0.0** (from 2.12.1), **globals 17.9.0**. Manifest and lockfile committed together by CI only after `npm ci --ignore-scripts --no-audit --no-fund`, `npm ls --depth=0`, `npx tsc --project tsconfig.test.json --noEmit` and `npm run test:ci` passed on Ubuntu 24.04/Node24. [Proof run 39014530155](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39014530155).
- [8250abb](https://github.com/DjGreenKrk/wifi-tally/commit/8250abba14ab12b9d263b16bab792392e0da5349) + [648effc](https://github.com/DjGreenKrk/wifi-tally/commit/648effc9fc9ae73c5147d3a6951cf92b96fbdd8e) + [d1cbfdd](https://github.com/DjGreenKrk/wifi-tally/commit/d1cbfdd1f55e94619ca323c9a4a7f6bd4420b93c): real test type fixes in ChannelSelector, removed nonexistent `AppConfiguration.save` mocks, typed OBS MockCommunicator as real MixerCommunicator subclass, corrected void promises, OBS polling now waits for state equality rather than always-true array reference comparisons; migrated Jest fake timer API.
- [a4dce4e](https://github.com/DjGreenKrk/wifi-tally/commit/a4dce4e1283b891348720124c872b3a6085b28b8): `hub/eslint.config.cjs` for **ESLint 10 flat config** with JS recommended, TypeScript recommended, React Hooks and Cypress checks. It analyzes the real code and is not silently skipped or faked.
- **Typechecking target GREEN** on [39014669326](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39014669326): `npx tsc --project tsconfig.test.json --noEmit` passed without `@ts-nocheck`, exclusion or alternative bypass.
- **Lint target still RED:** same run, `npm run lint` invoked installed ESLint 10 and found **153 errors, 1 warning**. Majority `@typescript-eslint/no-explicit-any`, `no-unused-vars`, `no-unused-expressions`, `prefer-as-const`, `ban-ts-comment` and `prefer-const`. **E2 lint acceptance remains OPEN; do not remove these rules to claim success.** [Log 39014669326](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39014669326/job/117344161401).
- [39014672692](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39014672692) quality gate and [39014672699](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39014672699) frontend fast CI green on ESLint config HEAD `a4dce4e`. These jobs **do not claim lint green**. Physical interactions / browser E3 still have separate acceptance gates.

### E6 packaging outside repository

- [004aab3](https://github.com/DjGreenKrk/wifi-tally/commit/004aab35e79ae9b1c1c3d09404ab786cb492bc2f) modifies Windows smoke to copy real `dist/vtally.exe`, `dist/frontend` and `dist/esp8266` into `RUNNER_TEMP/vtally-isolated-<guid>`, verifies absence of `node_modules`, runs the real EXE in that directory and probes HTTP/Socket.IO/NodeMCU loader. [390139... isolated Windows check: full job link](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39014056887/job/117342377919) initially; proven clean [390141... 004aab3 run](https://github.com/DjGreenKrk/wifi-tally/commit/004aab35e79ae9b1c1c3d09404ab786cb492bc2f) (see commit check `windows-exe`). Log contains `flasher probe response {}` and explicit `Using vTally ESP8266 firmware from D:\\a\\_temp\\vtally-isolated-...\\esp8266`, not from repo. Clean [004aab3 Windows run](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39013900000) is **not a verified run ID**; follow the commit checks instead.
- Limit: still need review actual distributable ZIP/real Windows host user actions (browser UI, tray) and USB device flashing. Only the isolated CI smoke is proven.

### E5 / E8 physical hardware acceptance procedure (NOT YET RUN)

1. On a clean Windows 10/11 PC **without repo or Node.js installed**, extract exported ZIP, run EXE, verify actual frontend routes and interactions as well as valid firmware bundle. Verify serial driver and COM port recognition through `flasher.device.get`.
2. Attach supported ESP8266 NodeMCU (take firmware/config backup first), enumerate device, test connect/read/write, flash firmware, set tally Wi-Fi/config, disconnect, reconnect and check persistent settings. Log COM port status **before and after**; confirm zero orphan handles.
3. Exercise NodeMCU connection timeout/unplug and retry with a real USB-serial port; verify timeout does not allow a late connection to remain open or overlap another operation. Do not substitute mock-based Jest coverage for this check.
4. Connect MIDI input/output interface, enumerate and send/receive an actual tally command through the EXE; verify physical mixer integration separately for each supported driver (OBS, Companion, ATEM, vMix, Roland etc.), including disconnect, timeout, UNKNOWN and recovery.
5. Capture test machine, Windows/driver versions, COM port/hardware, logs, exact Git SHA and PASS/FAIL for each. Until then mark **NIE SPRAWDZONO** for physical devices.

**E3/E4 status:** no React/Router/MUI or Express/Socket.IO/OBS application API major migration has been completed in this batch. Node24/TypeScript compatibility, test and packaging improvements are not substitutes for E3/E4. Remaining next blocker within E2 is cleanup of the 153 real lint findings; do not prematurely declare project fully modernized.
