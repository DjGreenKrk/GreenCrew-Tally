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
| pkg \`pkg.assets\` jawne prebuilds \`.node\` i midi build/Release | Pliki istnieją w drzewie npm, EXE nadal FAIL na \`node-gyp-build\` | [test dokumentowanych assetów](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38974191864) |

**Wniosek:** nie uznawać \`@yao-pkg/pkg\` za gotową bazę produkcyjnej paczki Windows. Kończymy dalsze eksperymenty w tej ścieżce w E1 zamiast ignorować błąd natywny lub podmieniać go mockiem. To jest wynik konkretnych prób, nie twierdzenie, że pkg nigdy nie może obsługiwać natywnych dodatków.

## Wybrany kierunek do E6: oficjalne Node.js SEA (Single Executable Applications)

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
