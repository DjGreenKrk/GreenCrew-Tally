# Audyt pełnej modernizacji vTally — PR #2

Data: 2026-10-16, Europe/Warsaw. Audytowany commit: `7a4888126b32df1d11155bb5bed31356139aa51d`.

PR: https://github.com/DjGreenKrk/wifi-tally/pull/2

Baza porównania: `feat/companion-http-tally`, commit `fc66c4b24b7039fe44ffcbebc4db6c0c02f1ccb6`. PR #1 pozostaje oddzielną ścieżką bazową. Niniejszy dokument zapisuje wyniki audytu, nie stanowi potwierdzenia wykonania poprawek.

## Cel i reguła doboru wersji

Celem jest pełna modernizacja kodu, zależności, narzędzi i dystrybucji, aby dalszy rozwój nie wymagał obchodzenia przestarzałych elementów. Sama zgodność istniejącego stosu z Node 24 nie kończy migracji.

Domyślnie wybieramy najnowsze stabilne wydania, a dla elementów mających cykl LTS — aktualną linię LTS. Całość musi działać razem. Starsza wersja wymaga konkretnej, zweryfikowanej przeszkody, opisanego uzasadnienia oraz warunku ponownej aktualizacji. Tagi `latest` nie zastępują sprawdzenia, czy wydanie jest stabilne i czy dana nazwa pakietu nie należy do porzuconej linii.

Zachowujemy potrzebną funkcjonalność i zgodność ze sprzętem. Dotychczasowe wersje bibliotek nie są ograniczeniem projektu. Nie wymagamy przepisywania całości ani przejścia na ESM bez związku z konkretnymi potrzebami.

## Werdykt

**PR nie realizuje jeszcze pełnej modernizacji i powinien pozostać draftem.** Wykonano wartościowy etap migracji narzędzi i sprawdzenia Node 24, ale większość stosu oraz część architektury pozostały bez migracji. Istnieją błędy blokujące działanie interfejsu i kompletną dystrybucję Windows.

Opis PR oraz `NODE24-MIGRATION.md` są nieaktualne: CRA zostało usunięte z zależności, działa Vite i samodzielny Jest, a eksperymentalne EXE z celem Node 24 już powstaje. Nie oznacza to jeszcze potwierdzenia działania gotowej aplikacji.

## Co zostało osiągnięte

- Zastąpiono CRA w skryptach budowania frontendem Vite 6.4.4.
- Testy przeniesiono do samodzielnego Jest 29.7.0.
- Na Windows z Node 24.21.0 przeszła instalacja zależności ze skryptami natywnymi, kompilacja backendu i frontendu oraz 30 zestawów testów: 276 zaliczonych, 1 pominięty.
- Natywne serialport i MIDI skompilowały się i załadowały w Node runnera.
- `@yao-pkg/pkg` 6.23.0 zbudował EXE z celem `node24-win-x64`, o rozmiarze 124 983 188 bajtów, oraz przygotowano osiem plików firmware.
- Usunięto własne importy Node `events` z części kodu frontendowego.
- W testach zapisu konfiguracji zastąpiono zapis asynchroniczny zapisem synchronicznym przed odczytem.

To jest postęp, lecz nie dowód zakończenia modernizacji. Znaczna część zmian dotyczy CI, pakowania i lockfile, a nie aktualizacji API i architektury aplikacji.

## Wyniki CI

| Kontrola | Wynik | Co faktycznie potwierdza |
|---|---|---|
| [Windows Node 24](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38963934872) | sukces | Instalacja, testy, kompilacja, serwer Vite oraz załadowanie natywnych modułów w Node runnera |
| [Quality gate](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38963943990) | sukces | TypeScript, Vite, Jest, kontrola wyjścia i odpowiedzi serwera Vite |
| [Frontend fast CI](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38963943880) | sukces | Budowanie i smoke HTTP frontendu |
| [EXE Node 24](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38963935049) | sukces | Utworzenie EXE i ośmiu plików firmware; bez uruchomienia EXE |
| [Windows EXE smoke](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38963944533) | błąd | Stary workflow używa Node 16 i zatrzymuje się podczas budowania Vite |
| [Dependency audit](https://github.com/DjGreenKrk/wifi-tally/actions/runs/38956622842) | raport utworzony | Raport podatności; workflow nie blokuje ich przez `npm audit ... || true` |

Zielony HTTP smoke nie wykonuje JavaScriptu aplikacji. Uruchamia Vite preview, sprawdza HTTP 200, znacznik `#root` i odnośnik do bundla. Nie uruchamia właściwego Huba i nie potwierdza renderowania Reacta.

## Potwierdzone blokery

### P1: błąd wykonania produkcyjnego bundla

`hub/src/mixer/obs/react/ObsSettings.tsx` importuje implementację `ObsConnector`, która importuje `obs-websocket-js`. Jego klasa Socket korzysta z Node `events`. Vite ostrzega o externalizacji tego modułu, a wykonanie wygenerowanego bundla w jsdom kończy się przed renderowaniem wyjątkiem:

```text
TypeError: Class extends value #<Object> is not a constructor or null
```

Należy oddzielić identyfikatory i modele współdzielone z UI od implementacji konektorów. Usunięcie własnych importów `events` w hookach nie usunęło zależności pośredniej. Reprodukcja dotyczy jsdom, nie pełnego testu Chromium.

### P1: konflikt peer dependencies ukrywany przez CI

Kontrola `npm ci --ignore-scripts --dry-run --no-audit --no-fund` bez `--legacy-peer-deps` kończy się `ERESOLVE`: `react-full-screen@0.3.2-0` wymaga React `^16.8.0`, podczas gdy projekt używa React 17.0.2.

Docelowo czysta instalacja musi działać bez pomijania kontroli peer dependencies. Obecna wersja react-full-screen jest dodatkowo wydaniem prerelease, mimo dostępnego stabilnego 1.1.1.

### P1: niekompletny artefakt Windows

`node24-exe-experiment.yml` publikuje tylko `dist/vtally.exe` i `dist/esp8266/**`. Brakuje `dist/frontend/**`, którego `server.ts` szuka obok EXE. Log uploadu potwierdza dziewięć plików: EXE i osiem plików Lua. Paczkę należy testować po rozpakowaniu do osobnego katalogu, bez korzystania z drzewa roboczego repozytorium.

### P1: pakowanie poza manifestem i lockfile

`package-windows.js` wymaga `@yao-pkg/pkg/lib-es5/bin.js`, ale manifest i lockfile nadal zawierają stare `pkg@5.8.1`, bez nowego pakera. Eksperyment instaluje `@yao-pkg/pkg` osobno przez `--no-save`, bez przypięcia wersji. Po czystym `npm ci` rozwiązanie ścieżki nowego pakera daje `MODULE_NOT_FOUND`.

Należy zapisać wybraną wersję nowego pakera w zależnościach developerskich i lockfile, usunąć stare pkg oraz testować standardowy skrypt budowania bez dodatkowego przygotowania specyficznego dla jednego workflow.

### P1: niezweryfikowane natywne zależności w EXE

Załadowanie serialport i MIDI w Node runnera nie dowodzi ich działania wewnątrz EXE. Skrypt pakujący znajduje pliki `.node` i wypisuje ich ścieżki, ale nie przekazuje znalezionej listy do pakera. Komentarz odwołuje się do `pkg.assets`, którego manifest nie zawiera. Automatyczne wykrywanie może działać; obecne testy tego nie rozstrzygają.

`RolandV8HDConnector.ts` dodatkowo ładuje MIDI przez `eval('require')` i składanie nazwy, utrudniając statyczne wykrywanie zależności. Wymagany jest test ładowania i enumeracji z wnętrza gotowego EXE, a następnie test sprzętowy.

### P1: workflow Windows nie odpowiada nowej gałęzi

`hub-windows-smoke.yml` nadal ustawia Node 16.20.2, pobiera nagłówki Node 16 i uruchamia `npx react-scripts test`, mimo usunięcia CRA. Budowanie Vite kończy się `crypto$2.getRandomValues is not a function`. Nie jest to dowód awarii Node 24. Należy ujednolicić workflow na gałęzi PR #2, bez zmiany bazowej ścieżki PR #1.

## Zakres modernizacji kodu nadal do wykonania

| Obszar | Konkretne miejsca / zadania |
|---|---|
| React | Zastąpić `ReactDOM.render`, dostosować kod i testy do aktualnego Reacta; usunąć ustawianie stanu przez `useMemo` podczas renderowania, np. w ObsSettings |
| Routing | Zmigrować Router 5, `Switch`, deklaracje tras i `withRouter` |
| UI | Zmigrować Material UI 4, `makeStyles`, `fade` i historyczne importy; Alert i AlertTitle przenieść ze starego lab do stabilnej biblioteki |
| Socket.IO | Aktualizować klienta i serwer razem, użyć zgodnych typów; poprawić obsługę `disconnect` zamiast `disconnected` i dostosować reconnect |
| OBS | Obsłużyć protokół 5 i aktualne API; wsparcie 4 utrzymywać tylko jako świadomie wydzieloną zgodność, jeśli potrzebna |
| Express i proxy | Dostosować API i routing przed podniesieniem majorów, w szczególności catch-all `app.get('*', ...)` |
| TypeScript | Zgodne typy Node/React/Jest, osobne konfiguracje backendu, przeglądarki i testów; kontrolowane zaostrzenie typowania zamiast bezterminowego `strict: false` |
| Lint | Zainstalować utrzymywane narzędzia, usunąć konfiguracje CRA, zapewnić działający skrypt i kontrolę w CI |
| Sprzęt | Ocenić adaptację NodeMCU Tool do współczesnego serialport; przetestować MIDI oraz flashowanie po aktualizacjach |
| Dystrybucja | Spójny paker, kompletny artefakt, uruchomienie EXE i test wrappera tray |
| Zależności pomocnicze | Aktualizować potrzebne pakiety, usuwać nieużywane; nie dodawać zależności tylko dla wyższego numeru wersji |
| CI | Usunąć zbędne workflow eksperymentalne i automatyczne przepisywanie zależności po domknięciu migracji; nie pobierać brakującego CRA przez npx |

`npm run lint` po czystej instalacji kończy się `eslint: not found`; `.eslintrc.js` nadal rozszerza `react-app` i `react-app/jest`.

### Istniejące problemy niezawodności, nie nowe regresje PR #2

- `NodeMcuConnector.hardReset()` rzuca wyjątek z callbacku `setTimeout`. Zewnętrzny `try/catch` oczekujący operacji nie przechwyci tego wyjątku. Timeout powinien odrzucić kontrolowaną operację i zgłosić błąd flashowania, nie zakończyć proces.
- `VmixConnector` po wyczerpaniu czasu reconnect wykonuje `process.exit(1)`. Utrata pojedynczej integracji kończy cały Hub; należy określić kontrolowaną obsługę awarii integracji i ewentualnego restartu.

## Uzasadnione wyjątki i ograniczenia kompatybilności

1. **Node 24 LTS dla Huba:** właściwy wybór. Nowsza linia Current nie jest obowiązkowa tylko z powodu wyższego numeru.
2. **TypeScript:** latest stable to 7.0.2, lecz aktualny `typescript-eslint@8.71.2` deklaruje `>=4.8.4 <6.1.0`. TypeScript 6.0.3 jest kandydatem na świadomy wyjątek przy tym linterze, do zweryfikowania z pozostałymi narzędziami. Nie uzasadnia pozostawienia 4.4.4.
3. **Companion:** osobny runtime hosta. Aktualny `@companion-module/base@2.2.1` deklaruje Node `^22.20 || ^26.5`, a tools 3.2.0 Node `^22.18`. Nie narzucać Node 24 modułowi działającemu w Companion. Obecne base 2.0.4 wymaga osobnej oceny aktualizacji.
4. **NodeMCU Tool:** 3.2.1 pozostaje latest pod tą nazwą, ale używa serialport 8. Sama zmiana numeru nodemcu-tool nie usuwa długu; potrzebny jest przegląd forka/transportu i test sprzętowy. Repo korzysta z forka GitHub; numer pakietu nie dowodzi tożsamości z wydaniem npm.
5. **MUI Lab:** tag latest wskazuje beta. Nie dodawać beta tylko dla tagu latest; używane Alert i AlertTitle mają stabilne odpowiedniki.
6. **Pakiety już na latest:** m.in. tmp-promise, identity-obj-proxy, @types/tmp, lato-font, nosleep.js i forever-monitor. Ich utrzymanie i potrzebę użycia oceniać osobno; niski numer nie jest sam w sobie powodem wymiany.

Każdy zaakceptowany wyjątek powinien zawierać: pakiet i wersję, ograniczenie, dowód, sposób izolacji oraz warunek ponownej aktualizacji. Powyższe kandydatury nie oznaczają jeszcze przetestowania całego zestawu docelowego.

## Bezpieczeństwo

Raport CI i lokalny audyt produkcyjny wykazały:

| Zakres | Critical | High | Moderate | Low | Razem |
|---|---:|---:|---:|---:|---:|
| Produkcyjne | 1 | 6 | 12 | 4 | 23 |
| Wszystkie | 4 | 46 | 23 | 4 | 77 |

Zgłoszenia produkcyjne obejmują m.in. proxy-addr, http-proxy-middleware, xml2js i drzewo Socket.IO. Wymagają oceny osiągalności w rzeczywistej konfiguracji; licznik nie oznacza tylu potwierdzonych możliwości ataku. Zielony workflow oznacza utworzenie raportu, nie brak podatności. Należy naprawić zgłoszenia lub zapisać konkretną ocenę i uzasadnienie wyjątków.

## Kryteria zakończenia i kolejność prac

1. Ustalić zgodny zestaw aktualnych stabilnych/LTS wersji i jawne wyjątki; instalacja bez `--legacy-peer-deps`.
2. Zmigrować kod do nowych API, oddzielić UI od backendu i naprawić wykonanie produkcyjnego bundla.
3. Zapewnić działający lint, zgodne typy i oddzielne konfiguracje aplikacji/testów.
4. Zapisać paker w lockfile, opublikować komplet plików i uruchamiać rozpakowaną aplikację w CI.
5. Sprawdzić faktyczny przepływ Companion HTTP → Hub → Socket.IO/Web Tally i UDP, heartbeat, UNKNOWN oraz recovery.
6. Sprawdzić serialport i MIDI z wnętrza EXE; na sprzęcie upload Lua, zapis ustawień i restart ESP8266 oraz wymagane integracje mikserów.
7. Uporządkować błędy i zamykanie zasobów; awarie integracji nie mogą niekontrolowanie kończyć Huba.
8. Zaktualizować engines, dokumentację, opis PR i CI; usunąć obejścia oraz zbędne eksperymenty.

Samo naprawienie czerwonych checków nie kończy tego zakresu.

## Metoda i granice audytu

Inspekcja źródeł, zmian względem bazy PR, manifestu i lockfile; odczyt logów CI; sprawdzenie bieżących metadanych npm, engines, peerDependencies i deprecations. Lokalnie na Node 24.19.0 odtworzono build frontendu i backendu, smoke HTTP oraz 276 zaliczonych testów. Ponownie wykonano bundle w jsdom oraz kontrolę instalacji bez legacy-peer-deps w trybie dry-run.

Nie wykonano gotowego Windows EXE na lokalnym Windows ani fizycznych testów ESP/MIDI/mikserów. Docelowych aktualizacji nie instalowano i nie potwierdzono ich współpracy. Audyt nie przypisuje procentowego ukończenia, ponieważ brak uzgodnionego podziału prac pozwalającego taki procent wiarygodnie policzyć.

Źródła:

- [Manifest i lockfile audytowanego commita](https://github.com/DjGreenKrk/wifi-tally/tree/7a4888126b32df1d11155bb5bed31356139aa51d/hub)
- [Metadane npm](https://registry.npmjs.org/)
- [Cykl wydań Node](https://github.com/nodejs/Release)
- [Wsparcie wydań Vite](https://vite.dev/releases)
- [Kompatybilność typescript-eslint](https://typescript-eslint.io/users/dependency-versions/)
- [Migracja Express 5](https://expressjs.com/en/guide/migrating-5/)
- [OBS WebSocket JS](https://github.com/obs-websocket-community-projects/obs-websocket-js)

## Inwentarz zależności

Poniższa tabela jest migawką z 2026-10-16. `latest` dotyczy nazwy pakietu, może wskazywać prerelease lub historyczną linię. To zestawienie zaległości, nie gotowa macierz kompatybilności.

| Pakiet bezpośredni | Zakres | Lockfile | Tag latest |
|---|---|---|---|
| `atem-connection` | produkcyjny | 3.10.2 | 3.10.3 |
| `escape-string-regexp` | produkcyjny | 4.0.0 | 5.0.0 |
| `express` | produkcyjny | 4.22.2 | 5.3.0 |
| `forever-monitor` | produkcyjny | 3.0.3 | 3.0.3 |
| `http-proxy-middleware` | produkcyjny | 1.3.1 | 4.2.0 |
| `midi` | produkcyjny | 1.0.4 | 2.0.0 |
| `nodemcu-tool` | produkcyjny | 3.2.1 | 3.2.1 |
| `obs-websocket-js` | produkcyjny | 4.0.3 | 5.0.8 |
| `socket.io` | produkcyjny | 2.5.1 | 4.8.4 |
| `socket.io-client` | produkcyjny | 2.5.0 | 4.8.4 |
| `tmp-promise` | produkcyjny | 3.0.3 | 3.0.3 |
| `xml2js` | produkcyjny | 0.4.23 | 0.6.2 |
| `yargs` | produkcyjny | 15.4.1 | 18.2.0 |
| `@babel/core` | developerski | 7.29.7 | 8.0.7 |
| `@babel/preset-env` | developerski | 7.29.7 | 8.0.7 |
| `@babel/preset-react` | developerski | 7.29.7 | 8.0.1 |
| `@babel/preset-typescript` | developerski | 7.29.7 | 8.0.7 |
| `@material-ui/core` | developerski | 4.12.4 | 4.12.4 |
| `@material-ui/icons` | developerski | 4.11.3 | 4.11.3 |
| `@material-ui/lab` | developerski | 4.0.0-alpha.61 | 4.0.0-alpha.61 |
| `@testing-library/jest-dom` | developerski | 5.17.0 | 7.0.1 |
| `@testing-library/react` | developerski | 11.2.7 | 16.3.3 |
| `@testing-library/user-event` | developerski | 12.8.3 | 14.6.8 |
| `@types/express` | developerski | 4.17.25 | 5.0.6 |
| `@types/jest` | developerski | 26.0.24 | 30.0.0 |
| `@types/node` | developerski | 12.20.55 | 26.6.5 |
| `@types/react` | developerski | 16.14.70 | 19.3.0 |
| `@types/react-dom` | developerski | 16.9.25 | 19.3.0 |
| `@types/react-router` | developerski | 5.1.20 | 5.1.20 |
| `@types/react-router-dom` | developerski | 5.3.3 | 5.3.3 |
| `@types/socket.io` | developerski | 2.1.13 | 3.0.2 |
| `@types/socket.io-client` | developerski | 1.4.36 | 3.0.0 |
| `@types/tmp` | developerski | 0.2.6 | 0.2.6 |
| `babel-jest` | developerski | 29.7.0 | 30.5.2 |
| `cross-env` | developerski | 7.0.3 | 10.1.0 |
| `cypress` | developerski | 6.9.1 | 16.2.0 |
| `electron` | developerski | 22.3.27 | 44.8.0 |
| `electron-builder` | developerski | 24.13.3 | 26.15.3 |
| `eslint-plugin-cypress` | developerski | 2.15.2 | 7.0.2 |
| `identity-obj-proxy` | developerski | 3.0.0 | 3.0.0 |
| `jest` | developerski | 29.7.0 | 30.5.2 |
| `jest-environment-jsdom` | developerski | 29.7.0 | 30.5.2 |
| `jest-extended` | developerski | 0.11.5 | 7.0.0 |
| `lato-font` | developerski | 3.0.0 | 3.0.0 |
| `nosleep.js` | developerski | 0.12.0 | 0.12.0 |
| `pkg` | developerski | 5.8.1 | 5.8.1 |
| `react` | developerski | 17.0.2 | 19.3.1 |
| `react-dom` | developerski | 17.0.2 | 19.3.1 |
| `react-full-screen` | developerski | 0.3.2-0 | 1.1.1 |
| `react-router-dom` | developerski | 5.3.4 | 7.18.4 |
| `ts-node` | developerski | 9.1.1 | 10.9.2 |
| `typescript` | developerski | 4.4.4 | 7.0.2 |
| `vite` | developerski | 6.4.4 | 8.3.4 |
| `web-vitals` | developerski | 0.2.4 | 6.2.3 |
