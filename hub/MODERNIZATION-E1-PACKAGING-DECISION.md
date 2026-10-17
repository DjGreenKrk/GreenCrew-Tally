# E1 — decyzja techniczna dotycząca dystrybucji Windows

Data: 2026-10-16. Zakres: PR #2 (nie dotyczy PR #1). **Decyzja dotyczy architektury dalszego wdrożenia, a nie potwierdzenia działania docelowego EXE.**

## Kryteria

- Node 24 LTS, najnowszy spójny zestaw zależności, instalacja bez \`--legacy-peer-deps\`, \`--force\` lub obejść OpenSSL.
- Produkcyjne EXE uruchamiane bez Node i bez drzewa repo; zasoby frontend i 8 plików ESP8266, natywne serialport/MIDI, tray. W środku uruchomionego EXE ma działać enumeracja urządzeń, nie tylko \`require()\` na runnerze.
- ESM-only zależności muszą działać z właściwym, przetestowanym modelem bundlingu. Transportu mock nie wolno przedstawiać jako ESP/MIDI.

## Próby i wyniki (Windows Server 2022, Node 24.21.0)

| Przypadek | Wynik | Dowód |
|---|---|---|
| TS 7.0.2 + typescript-eslint 8.71.2 | ERESOLVE; peer zakres TS >=4.8.4, <6.1.0 | [E1](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972370924) |
| TS 6.0.3 / ESLint 10 / Jest 30 / JSX / Babel | Izolowane próby zakończone sukcesem po aktualizacji moduleResolution; docelowy lint/Jest repo wciąż do migracji | [E1](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972999732) |
| Serialport 13 + MIDI 2 + ESM-only import w zwykłym Node 24 | PASS (COM2, MIDI 0 urządzeń; **bez fizycznego sprzętu**) | [E1](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972999732) |
| @yao-pkg/pkg 6.23 — dynamiczny \`import()\` w snapshot EXE | FAIL \`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING\` | [E1](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972999732) |
| @yao-pkg/pkg 6.23 — natywne serialport/MIDI bez ESM | FAIL \`No native build was found ... @serialport/bindings-cpp\` w izolowanym EXE | [E1](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972999732) |
| esbuild → CJS → @yao-pkg/pkg → izolowane EXE | esbuild i EXE build PASS, uruchomienie FAIL na natywnej bibliotece | [E1](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38972999732) |
| pkg jawne `pkg.assets` — poprzednia próba | **NIEKONKLUZYWNA:** `pkg app.cjs` nie wczytał konfiguracji bez `--config package.json`; poprzedni FAIL nie dowodzi nieskuteczności jawnych assetów. | [38974191864](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38974191864) |

**Historyczny wniosek (zastąpiony dowodami poniżej):** nie uznawać \`@yao-pkg/pkg\` za gotową bazę produkcyjnej paczki Windows. Kończymy dalsze eksperymenty w tej ścieżce w E1 zamiast ignorować błąd natywny lub podmieniać go mockiem. To jest wynik konkretnych prób, nie twierdzenie, że pkg nigdy nie może obsługiwać natywnych dodatków.

## Plan awaryjny E6: Node.js SEA (tylko jeżeli dalsze testy produkcyjne wykażą blokadę pkg)

Przygotować z Node 24 na **Windows x64** pojedynczą aplikację Node SEA z backendem po bundlingu do CJS. Node SEA oficjalnie dopuszcza zasoby \`assets\`, a do ładowania dodatków \`.node\` udostępnia \`node:sea.getRawAsset()\` + zapis na fizyczny dysk + \`process.dlopen()\`. To trzeba sprawdzić na **uruchomionym EXE**; samo utworzenie blobu nie jest odbiorem. Można też umieścić natywne pliki obok EXE, jeśli są prawidłowo ładowane z lokalizacji dystrybucji i nie wymagają instalacji Node; decyzja ma być poparta porównaniem prostoty i niezawodności obu wariantów.

Dokumentacja:
- https://nodejs.org/download/release/v24.18.0/docs/api/single-executable-applications.html — sposób przygotowania SEA i natywne addons.
- https://yao-pkg.github.io/pkg/guide/native-addons — mechanizm i jawne assets w pkg; sprawdzony, ale w tej próbie nieskuteczny.

### Warunki odbioru wariantu SEA (nie spełnione jeszcze)

1. Kontrolowany Node 24 LTS, zablokowane wersje esbuild/postject i komenda budowania bez doinstalowywania narzędzi poza lockfile.
2. Node SEA EXE uruchamia pełen serwer, frontend, Companion HTTP, Socket.IO, UDP, Web Tally, konfigurację z dowolnego katalogu i wszystkie 8 plików Lua.
3. Dedykowany tryb diagnostyczny **wewnątrz EXE** ładuje serialport13 i MIDI2 i wywołuje enumerację; rezultat zawiera wersję Node, ABI, znalezione porty lub zero urządzeń, ewentualny błąd. Brak portów jest akceptowalny, brak dodatku natywnego — nie.
4. Paczka ZIP rzeczywiście publikowana w workflow, pobrana przez drugi job na osobnym runnerze, rozpakowana poza repo, EXE uruchomione bez Node w PATH. Sprawdzić tray, czyste wyjście i brak osieroconych procesów.
5. Testy fizycznego sprzętu: ESP8266, MIDI i miksery nadal oznaczyć **NIE SPRAWDZONO**, dopóki nie będą realnie wykonane i udokumentowane.

Dopiero po pozytywnych wynikach usunąć \`@yao-pkg/pkg\`, dawny skrypt pkg i diagnostyczne workflow E1; na razie pozostają w gałęzi roboczej, ponieważ docelowa zamiana nie została jeszcze wdrożona.

## Wyjątki i termin ponownej oceny

- **TypeScript6 zamiast TS7** — udokumentowany peer constraint typescript-eslint8.71.2; ponownie sprawdzić przy wydaniu typescript-eslint z oficjalną zgodnością TS7.
- **Runtime @yao-pkg/pkg Node24.20 vs runner Node24.21** — nie jest zaakceptowanym wyjątkiem produkcyjnym, gdyż cały wariant pkg nie przeszedł testów. SEA budować z zatwierdzonym Node 24 LTS i zachować zgodność wersji.
- Starsze React17/Router5/MUI4, Socket.IO2/Express4, OBS4, MIDI1 i flasher serialport8 są **otwartą pracą**, nie zatwierdzonymi wyjątkami.

## Korekta decyzji po poprawnej próbie — 2026-10-17

**DECYZJA: kontynuować `@yao-pkg/pkg@6.23.0` z jawną konfiguracją `--config package.json` jako bieżącą ścieżkę E6; nie rozpoczynać SEA tylko na podstawie błędnej próby bez odczytu config.** SEA pozostaje ograniczonym wariantem awaryjnym na wypadek udokumentowanego problemu przy pełnym EXE, np. rzeczywiście potrzebnego dynamicznego importu ESM, którego pakowanie nie obsłuży.

- **[E1 native-in-exe, PASS — 39013097025](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39013097025/job/117339586187)**. Git SHA [f625cc6](https://github.com/DjGreenKrk/wifi-tally/commit/f625cc6caafd10a2f19bbba9e2d7f95630f7b850), Windows Server 2022, Node 24, polecenie `node hub/scripts/check-pkg-native-assets.cjs`. `npm install --save-exact serialport@13.0.0 midi@2.0.0 @yao-pkg/pkg@6.23.0`, `pkg app.cjs --config package.json --targets node24-win-x64`: oba PASS. EXE skopiowany do niezależnego folderu, wykonane `SerialPort.list()` oraz `midi.Input().getPortCount()`, PASS. Skrypt wymusza w EXE marker `E1_PKG_CONFIG_APPLIED=true`, obecność plików `.node` przez `E1_NATIVE_ASSETS` i enumerację `E1_NATIVE_OK` przed zaliczeniem. Skrypt nie może zaliczyć tylko po utworzeniu EXE.
- **[Pełny stary-stack Hub EXE smoke, PASS — 39013099542](https://github.com/DjGreenKrk/wifi-tally/actions/runs/39013099542/job/117339593040)**, ten sam SHA, Windows Server 2022/Node 24; `npm ci --foreground-scripts`, `npm run test:ci` (33 suites / 281 PASS / 1 SKIP), `npm run build:windows`, start `dist/vtally.exe`, zapytanie WebSocket `flasher.device.get`. Odpowiedź `{}`, bez wcześniejszego `Could not load the NodeMCU tool` i bez braku `@serialport/bindings/build/Release/bindings.node`. To **nie** stanowi testu prawdziwego programowania ESP8266 ani uruchomienia opublikowanego ZIP poza repo.
- Ograniczenie: test E1 korzysta z **Serialport 13 + MIDI 2**; aktualny duży Hub nadal bazuje na starszym forku NodeMCU-Tool, Serialport 8 i MIDI 1. Samo działanie obu izolowanych przykładów nie oznacza zakończenia E5 ani migracji API. Dynamiczny `import()` wewnątrz pkg snapshot wcześniej miał `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`; tego wyniku nie unieważnia sukces natywnych assetów.
- Odbiór E6 nadal wymaga kompilacji i uruchomienia **docelowego** zestawu zależności oraz niezależnego katalogu/ZIP, frontendu, wszystkich plików Lua, prawidłowej obsługi błędów i zamknięcia tray. Dopiero po regresji niemożliwej do usunięcia w ograniczonej poprawce pkg wykonać ograniczony SEA spike i porównać wyniki.
- Fizyczne ESP8266, interfejs MIDI, fizyczny mikser: **NIE SPRAWDZONO**.
