# Plan wdrożenia pełnej modernizacji vTally

Data: 2026-10-16. Status: **plan przygotowany; implementacja etapów poniżej nie została jeszcze wykonana**.

PR roboczy: [#2](https://github.com/DjGreenKrk/wifi-tally/pull/2), gałąź `feat/node24-modernization-poc`.

Podstawa: [audyt pełnej modernizacji](MODERNIZATION-AUDIT-2026-10-16.md). Audyt opisuje kod `7a4888126b32df1d11155bb5bed31356139aa51d`; dokument audytu dodano w `7686f91ceb2b94a2f08cdca96e39d7646516c978`.

## 1. Cel i definicja zakończenia

Modernizujemy kod, narzędzia, zależności i dystrybucję tak, aby dalsza rozbudowa nie wymagała znajomości obejść starego stosu. Zachowujemy istniejące funkcje Huba, integracje, Web Tally, UDP tally, Companion HTTP oraz programowanie ESP8266.

Domyślnie wybieramy aktualne stabilne wersje albo aktualną linię LTS. Wersje muszą być zgodne ze sobą. Starsze wydanie dopuszczamy wyłącznie po zapisaniu konkretnego ograniczenia i warunku aktualizacji. Nie używamy prerelease tylko dlatego, że wydawca umieścił je pod tagiem latest.

Zakończenie oznacza jednocześnie:

- czystą instalację bez `--legacy-peer-deps`, `--force` i obejść OpenSSL;
- zgodny zestaw wersji zapisany w manifestach i lockfile;
- działającą aplikację developerską oraz produkcyjną, także z gotowej paczki Windows;
- aktualne API bibliotek i usunięte wykryte problemy granic UI/backend oraz obsługi awarii;
- działający lint, typowanie i testy jednostkowe, integracyjne, przeglądarkowe oraz test dystrybucji;
- potwierdzenie wymaganych funkcji sprzętowych, z osobną ewidencją tego, czego nie można sprawdzić automatycznie;
- udokumentowane wyjątki, aktualną instrukcję uruchomienia i usunięte zbędne eksperymenty migracyjne.

Zmiana numerów zależności, utworzenie EXE albo zielony build osobno nie spełniają tej definicji.

## 2. Granice i sposób prowadzenia prac

1. Wszystkie zmiany modernizacyjne prowadzimy na gałęzi PR #2. Nie zmieniamy gałęzi PR #1, nie scalamy jej i nie przebudowujemy jej stabilnej ścieżki pod nowe wymagania.
2. Przed każdą serią zmian sprawdzamy aktualny HEAD i stan drzewa. Nie nadpisujemy równoległych zmian użytkownika ani innych narzędzi.
3. Każdy etap kończy się małym zestawem logicznych commitów i zapisem dowodów. Manifest, lockfile i kod korzystający ze zmienionego API należą do tej samej logicznej zmiany.
4. Wersje wybieramy raz na początku etapu, po sprawdzeniu engines, peerDependencies, stabilności i stanu utrzymania. Nie przesuwamy całego zestawu codziennie za kolejnym patchem podczas trwającej migracji. Przed wydaniem wykonujemy końcowy przegląd aktualizacji.
5. Nie usuwamy funkcji, nie wyłączamy testów i nie łagodzimy kryteriów, aby uzyskać zielony wynik. Testy aktualizujemy wtedy, gdy zmienia się API narzędzi lub rzeczywiście zamierzony kontrakt zachowania.
6. Nie wykonujemy masowego przepisywania katalogów, wymiany frameworka UI ani konwersji całego projektu na ESM bez potrzeby. Konwersja konkretnej granicy modułów ma wynikać z wymagań wybranych bibliotek i pakera.
7. Drobne, niezwiązane porządki nie rozszerzają etapu. Usuwamy natomiast obejścia, nieużywane zależności i kod porzuconych narzędzi związane z migracją.

## 3. Zestaw wersji do zweryfikowania

Poniższe wersje są migawką kandydatów z audytu 2026-10-16. Nie stanowią deklaracji przetestowania całego zestawu. Przy rozpoczęciu etapu należy sprawdzić nowe poprawki i zatwierdzić dokładne wersje w rejestrze decyzji.

| Obszar | Kandydat / decyzja | Wymagana weryfikacja |
|---|---|---|
| Hub | Node 24 LTS, aktualna poprawka tej linii; odpowiadające typy Node 24 | Zgodność kompilatora, zależności natywnych i runtime EXE |
| TypeScript | 6.0.3 jako kandydat przy obecnym typescript-eslint | Latest TS 7.0.2 wykracza poza deklarowane wsparcie lintera; wyjątek udokumentować albo zastosować sprawdzony zgodny zestaw |
| Lint | ESLint 10.13.0, typescript-eslint 8.71.2, aktualne stabilne pluginy React i hooks | Peers całego zestawu; płaska konfiguracja i reguły dla osobnych środowisk |
| Frontend | React/DOM 19.3.1, odpowiadające typy, Router 7.18.4 | Uruchomienie Reacta, nawigacja, stan i cykl życia |
| UI | @mui/material i ikony 9.5.0, wymagany stabilny silnik stylów | Peers, zmiany komponentów i stylów; Alert/AlertTitle bez lab alpha/beta |
| Bundler | Vite 8.3.4; zgodny oficjalny plugin React, jeśli potrzebny dla przyjętej konfiguracji | Produkcyjny JS, dev proxy/HMR i właściwy zestaw przeglądarek |
| Testy jednostkowe | Jest/babel-jest/jsdom environment 30.5.2; zgodna linia Babel 8; aktualne Testing Library i jest-extended | Transformacje TS/JSX, fake timers, DOM, mocks; wersje peer i importy setup |
| E2E | Cypress 16.2.0 | Migracja konfiguracji, zadań node i wszystkich istniejących scenariuszy; bez równoległego dodawania drugiego frameworka E2E |
| HTTP | Express 5.3.0 i proxy middleware 4.2.0 | Routing catch-all, błędy async, proxy HTTP/WebSocket |
| Socket.IO | Klient i serwer 4.8.4 | Handshake, subskrypcje, disconnect/reconnect, własne typy zdarzeń |
| Integracje | OBS JS 5.0.8, ATEM 3.10.3, XML2JS 0.6.2, MIDI 2.0.0 | Zmiany protokołów i API, fixture'y oraz realny sprzęt |
| Flasher | Serialport 13.0.0; transport NodeMCU do adaptacji | Enumeracja, NodeMCU Lua transport, upload, weryfikacja, reset; nie podmieniać transitive dependency ślepym override |
| Windows | @yao-pkg/pkg 6.23.0, Electron 44.8.0, builder 26.15.3 | Natywne dodatki, sposób ładowania modułów, wrapper tray i komplet zasobów |
| Companion | Base 2.2.1 i tools 3.2.0 jako kandydaci, runtime zgodny z hostem | Node 22 według wymagań hosta/tools; nie narzucać Node 24 z Huba |
| Pozostałe | Przegląd wszystkich 54 wpisów z audytu | Aktualizacja albo usunięcie; aktualność nazwy pakietu nie gwarantuje utrzymania |

Nie zmieniamy Jest na inny runner tylko dla modernizacji: najpierw próbujemy aktualnego stabilnego Jest. Nie dokładamy frameworków o podobnej roli bez udokumentowanej konieczności.

## 4. Rejestr decyzji i dowodów

W implementacji utrzymujemy `hub/MODERNIZATION-STATUS.md`, utworzony w etapie E0. Zawiera:

- wybraną dokładną wersję każdego pakietu i środowiska;
- status każdego etapu: nie rozpoczęto / w trakcie / zakończono / blokada;
- dla zakończonego etapu: commit, polecenia, platformę, wynik i link do CI;
- wyjątki: komponent, starsza wersja, wymaganie blokujące latest, dowód, zakres wpływu i warunek ponownej oceny;
- testy sprzętowe: konkretny model, metoda, wynik, wersja EXE i firmware; brak sprzętu oznacza „nie sprawdzono”, nie „zaliczone”;
- odrzucone warianty tylko wtedy, gdy ich wynik uzasadnia decyzję techniczną.

Planu i audytu nie przepisujemy tak, aby ukryć niezaliczone etapy. Historyczny audyt pozostaje migawką.

## 5. Etapy wdrożenia

### E0 — zakres, kontrakty i punkt odniesienia

Zależności: brak. Kod startowy: aktualny HEAD PR #2, z zachowaniem audytowanego SHA jako odniesienia.

Prace:

1. Utworzyć rejestr statusu. Wypisać istniejące integracje i funkcje na podstawie kodu, nie tylko README.
2. Zapisać kontrakty: snapshot Companion, heartbeat, UNKNOWN versus puste listy Program/Preview, recovery, komendy UDP, zdarzenia Web Tally, schemat konfiguracji i zapis projektu vMix.
3. Zidentyfikować pliki ustawień i przygotować fixture'y migracyjne. Testy mają używać osobnych katalogów tymczasowych, nigdy konfiguracji użytkownika.
4. Przypisać istniejące testy jednostkowe i Cypress do funkcji; odnotować znane błędy, aby nie przedstawiać ich jako nowych regresji.
5. Zatwierdzić macierz wersji i wstępne wyjątki. Odświeżyć opis PR do pełnego zakresu modernizacji i faktycznego stanu.

Odbiór: zapisane kontrakty i wersje, odtwarzalny wynik bazowy 276 testów + 1 pominięty albo jawne wyjaśnienie różnicy; brak przypisywania tego wyniku gotowemu produktowi.

### E1 — próby techniczne granic o największym ryzyku

Zależności: E0. Próby krótkie, odizolowane; nie przerabiamy jeszcze całego UI.

1. **Format modułów i EXE:** zbudować minimalny proces z wybraną linią Node/pakera i rzeczywistym sposobem ładowania nowych zależności, zwłaszcza ESM-only. Sprawdzić dynamiczne importy i zależności natywne w EXE. Nie przyjmować, że kompilacja CommonJS lub Node require(ESM) gwarantuje zgodność snapshotu pakera.
2. **Serialport i MIDI:** sprawdzić współczesne API, build i enumerację w zwykłym Node. Rozrysować zmianę transportu NodeMCU względem używanego forka.
3. **Toolchain TS/lint/test:** wykonać minimalną kompilację TS/TSX, lint i test z docelowym zestawem. Zweryfikować wyjątek TypeScript 6 kontra 7.
4. Wybrać sposób adaptacji NodeMCU: najpierw minimalna adaptacja istniejącego transportu do serialport 13 z zachowaniem komend Lua. Jeżeli wymaga lokalnego pakietu/vendorowania, zapisać pochodzenie, commit i licencję. Nie zmieniać repo upstream bez osobnego zakresu.

Odbiór: działające małe próby i zapis decyzji. Blokada pakera dotyczy tej granicy; nie uzasadnia cofnięcia całego stosu do Node 16. Jeśli wymagany jest inny sposób dystrybucji, przygotować konkretny wariant z tymi samymi funkcjami i zapisać zmianę architektoniczną przed rozbudową rozwiązania.

### E2 — narzędzia, typowanie i testy jako działająca baza

Zależności: E1.

Pliki: `hub/package.json`, lockfile, konfiguracje TS/Jest/Babel/ESLint/Cypress, skrypty developerskie i odpowiednie workflow.

1. Zainstalować wybrany zestaw kompilatora, typów, lintowania i testów. Usunąć konfiguracje CRA i zbędne zależności pośrednio zapewniane wcześniej przez CRA.
2. Oddzielić ustawienia TS dla kodu wspólnego, backendu, frontendu i testów. Nie wprowadzać globalnych typów Cypress do produkcyjnego backendu.
3. Dopasować wersje typów do runtime; usunąć stare zewnętrzne typy bibliotek mających własne deklaracje.
4. Wprowadzić płaską konfigurację ESLint, właściwe środowiska, reguły hooków i sprawdzanie granic importów. `npm run lint` ma działać bez npx doinstalowującego narzędzia.
5. Zmigrować Jest, konfigurację transformacji i helpery; obsłużyć zmiany fake timers, cleanup i bibliotek testowych. Zachować semantykę testów.
6. Ustawić docelowe polecenia `lint`, `typecheck`, `test:ci`, budowania i uruchamiania. Typowanie frontendowe nie może polegać wyłącznie na transpilerze Vite.
7. Zaostrzać typowanie w modernizowanych modułach. Docelowo `strict: true` dla kodu aplikacji; ewentualny zakres odroczony wymaga wpisu z konkretnymi plikami i powodem, nie globalnego wyłączenia bez terminu.

Odbiór: lint, typecheck i testy na docelowych narzędziach. Dopóki E3 nie usunie konfliktów React/UI, instalacja całej aplikacji może być etapem przejściowym, jawnie oznaczonym; zakończenie E2 nie oznacza jeszcze spełnienia końcowego kryterium czystej instalacji.

### E3 — granica UI/backend oraz cały frontend

Zależności: E2; wynik próby ESM z E1.

1. Utworzyć lekki moduł współdzielonych identyfikatorów i kontraktów. Komponenty ustawień nie importują klas konektorów dla samego ID. Rozdzielić importy wartości od `import type`.
2. Wydzielić browser-safe emitter z modułu atrap testowych albo zastosować utrzymywany lekki mechanizm zgodny z faktycznie używanym API. Atrapy testowe nie mają definiować architektury produkcyjnego frontendu.
3. Zaktualizować React/DOM i typy, zastąpić `ReactDOM.render`, poprawić skutki uboczne podczas renderowania i cleanup subskrypcji.
4. Zmigrować routing: trasy, parametry, przekierowania, brak strony i bezpośrednie otwieranie deep-linków. Zachować obecne adresy URL, chyba że zmiana ma jawne uzasadnienie.
5. Zmigrować MUI i style do utrzymywanego API, zachowując funkcje formularzy, walidację, kontrast, kolory stanów i pełnoekranowe Web Tally. Alert/AlertTitle przenieść do stabilnych komponentów.
6. Zaktualizować Vite i konfigurację React. Zachować dev na porcie 3001, dostęp przez backend 3000, proxy i aktualizację developerską. Sprawdzić assety i docelową obsługę przeglądarek.
7. Zaktualizować react-full-screen. NoSleep pozostawić tylko, jeśli potrzebny dla faktycznie wspieranych urządzeń; ewentualne Wake Lock stosować z kontrolą wsparcia i zachowaniem działania na tych urządzeniach.
8. Sprawdzić i usunąć nieużywane web-vitals, cross-env, fonty i inne zależności; potrzebne przenieść na wybrane stabilne wersje.
9. Dodać test produkcyjnego bundla w rzeczywistej przeglądarce uruchomionej przez docelowy Cypress: widoczny interfejs, brak nieobsłużonych błędów JS, wejście na główne trasy. Samo HTTP 200 nie wystarcza.

Odbiór: działający frontend dev i production, zgodne peer dependencies React/UI/testów, formularze i Web Tally. Błąd bundla z audytu nie występuje. Typowe produkcyjne ścieżki importów nie zawierają implementacji backendu.

### E4 — backend, protokoły i odporność na awarie

Zależności: E2 i wspólne kontrakty z E3. Końcowy test UI wymaga zakończenia E3.

1. Zaktualizować Express, typy i proxy. Poprawić catch-all zgodnie z nowym routerem, obsługę błędów async oraz kolejność API → Socket.IO → statyczny frontend/fallback.
2. Zaktualizować Socket.IO po obu stronach w jednej zmianie. Dostosować interfejsy zdarzeń, handshake, subscribe/unsubscribe i reconnect. Poprawić błędne nasłuchiwanie `disconnected`; sprawdzić brak powielania listenerów po reconnect.
3. Zmigrować OBS do protokołu 5: połączenie i auth, zdarzenia i zapytania Program/Preview, scene collection, studio mode, stream/record/live mode. Dostosować testowy serwer/fixture'y. Nie zakładać mapowania nazw API 4 na 5 jeden do jednego.
4. Zaktualizować ATEM i XML2JS oraz pozostałe używane zależności HTTP/CLI, uwzględniając ESM i zmiany API. Testować odczyt istniejących ustawień i zachowanie vMix.
5. Usunąć `process.exit(1)` z logiki timeoutu pojedynczego konektora vMix. Po awarii stan ma być jawnie rozłączony/UNKNOWN, a Hub i pozostałe funkcje dostępne. Określić ponowienie/ręczne wznowienie zgodne z UI.
6. Poprawić zgłaszanie błędów async i zamykanie zasobów: gniazd, timerów, listenerów. Nie maskować problemów przez globalne ignorowanie wyjątków.
7. Dodać test uruchomionego Huba: snapshot i heartbeat HTTP, autoryzacja, identyczny snapshot jako heartbeat, timeout, UNKNOWN, recovery oraz równoczesne potwierdzenie przez Socket.IO i UDP. Używać procesów i portów kontrolowanych przez test.
8. Zweryfikować zapis i odczyt konfiguracji/projektu ze starych fixture'ów. Zmiana schematu wymaga kontrolowanej migracji i kopii, nie resetu ustawień.

Odbiór: przetestowane zachowanie integracji i komunikacji; awaria miksera nie zabija procesu; UNKNOWN nie zmienia się niejawnie w prawidłowy pusty Program/Preview.

### E5 — flasher i MIDI

Zależności: decyzje E1, narzędzia E2; końcowe testy UI po E3.

1. Wdrożyć wybraną adaptację NodeMCU do współczesnego serialport. Zachować enumerację, połączenie, odczyt modułów, plików i ustawień oraz upload Lua.
2. Naprawić `hardReset`: timeout odrzuca operację, pętla ma limit i kontrolowaną przerwę, port jest zwalniany, a UI otrzymuje błąd. Callback timera nie rzuca wyjątku poza operacją.
3. Uporządkować mutex: połączenie i sprzątanie należą do jednej wyłącznej operacji. Sprawdzić odłączenie urządzenia w trakcie i kolejną próbę po błędzie.
4. Zaktualizować MIDI i usunąć `eval('require')`/składanie nazwy. Przy wymaganej opcjonalności stosować jawny, obsługiwany przez paker punkt ładowania i zrozumiały stan błędu.
5. Zachować pełny komplet ośmiu plików Lua/LC i wybór poprawnej ścieżki firmware. Nie zastępować uploadu aplikacji Lua flashowaniem binarnego firmware NodeMCU, jeśli nie jest to istniejąca funkcja.
6. Testy automatyczne z atrapą transportu obejmują sukces, brak portu, zły odczyt po uploadzie, timeout restartu, odłączenie i możliwość ponowienia. Nie nazywać ich testami fizycznego ESP.

Odbiór automatyczny: scenariusze transportu i enumeracja. Odbiór sprzętowy: upload do ESP8266, porównanie plików, zapis ustawień, restart, ponowne wykrycie i faktyczne tally po sieci; MIDI na obsługiwanym urządzeniu. Brak sprzętu nie zatrzymuje E6/E7, ale pozostawia otwarty warunek wydania.

### E6 — kompletna dystrybucja Windows i tray

Zależności: E3, E4, automatyczna część E5 oraz decyzja pakowania E1.

1. Zapisać nowy paker w devDependencies i lockfile; usunąć stare pkg i instalowanie pakera przez `--no-save`.
2. Jawnie zapewnić wymagane zależności i dodatki natywne. Konfiguracja ma odpowiadać sposobowi podania entrypointu; sam log „Including” nie jest dowodem dołączenia.
3. Zbudować kompletną paczkę: EXE, frontend, firmware i wymagane zasoby. Sprawdzić ścieżki niezależne od bieżącego katalogu i od drzewa repo.
4. W nowym katalogu rozpakować dokładnie publikowany ZIP. Uruchomić EXE bez repozytorium i bez dostępu do node_modules projektu. Runner testowy może mieć Node do sterowania testem; EXE nie może go wymagać do działania.
5. Sprawdzić API, rzeczywiste assety JS/CSS i deep-linki, Web Tally, komunikację oraz enumerację portów z wnętrza EXE. Nie uznawać samej odpowiedzi flashera za sukces, jeśli zawiera błąd; sprawdzać treść wyniku i logi.
6. Zaktualizować Electron/builder, zbudować portable tray i sprawdzić: start Huba, otwarcie przeglądarki, Exit, brak osieroconego procesu, czytelny wynik zajętego portu/awarii dziecka.
7. Test fizycznego Windows bez zainstalowanego Node potwierdza deklarację samodzielności paczki; zapisać wersję Windows i SHA paczki.

Odbiór: testowana jest ta sama zawartość, którą użytkownik pobiera. Wersja runtime w EXE jest odczytana w kontrolowanej diagnostyce/testowym trybie, nie wywnioskowana wyłącznie z argumentu target.

### E7 — docelowe CI, zależności i dokumentacja

Zależności: etapy funkcjonalne E2–E6. Część konfiguracji CI powstaje wcześniej razem z etapami.

Docelowe kontrole:

| Kontrola | Platforma / runtime | Kryterium |
|---|---|---|
| Instalacja, lint, typecheck, unit | Linux, Node 24 LTS | Czysty lockfile i brak flag pomijających peer dependencies |
| Natywne buildy i backend | Windows, Node 24 LTS | Rzeczywiste skrypty instalacji, ładowanie i enumeracja |
| Frontend E2E + integracja Huba | Linux; przeglądarka Chromium | Dev i produkcyjny frontend, brak błędu startu JS, HTTP/Socket.IO/UDP |
| Paczka Windows | Windows | Budowa, rozpakowanie, uruchomienie i sprawdzenie tej samej paczki |
| Companion | Runtime zgodny z hostem, oddzielny od Huba | Instalacja, check, test i package |
| Audyt zależności | Docelowe drzewo | Raport oraz kontrolowany próg błędów z udokumentowanymi wyjątkami |

Prace:

1. Zastąpić niespójny Windows smoke i eksperymenty spójną ścieżką. Usunąć workflow automatycznie instalujące/commitujące zależności po zakończeniu ich zadania. Nie tworzyć kolejnych wariantów workflow do każdej poprawki skryptu.
2. Przenieść istniejące scenariusze Cypress do aktualnej konfiguracji. Scenariusze manualne pozostawić jawnie manualnymi.
3. Zaktualizować moduł Companion w ramach jego środowiska i zachować kontrakt komunikacji z Hubem. Dodać odtwarzalny lockfile, jeżeli przyjęty workflow pakowania na to pozwala; wyjaśnić wyjątek, jeśli narzędzia hosta wymagają innego sposobu.
4. Sprawdzić wszystkie bezpośrednie i istotne pośrednie zależności. Usunąć nieużywane; zgłoszenia bezpieczeństwa naprawić albo ocenić na podstawie osiągalności i zapisać wyjątki. Nie uruchamiać ślepego `audit fix --force`.
5. Zaktualizować deklaracje engines/platform, README, NODE24-MIGRATION, opis PR i instrukcję testów sprzętowych. Stare instrukcje Node/CRA i nieużywany crypto shim usunąć albo wyraźnie odizolować jako archiwalne, jeśli potrzebne do historii.
6. Dla każdej dostępnej platformy deklarować tylko sprawdzony zakres. Windows i Linux mają własne dowody; macOS/ARM bez testu pozostają niezweryfikowane, a nie domyślnie zaliczone.

Odbiór: jeden spójny zestaw checków, bez nieaktualnych czerwonych ścieżek i ukrytych instalacji; dokumentacja odpowiada działającemu kodowi.

### E8 — odbiór końcowy

Zależności: E7 oraz wymagane testy sprzętowe E5/E6.

1. Sprawdzić aktualny HEAD i końcowy diff względem PR #1; potwierdzić brak niezamierzonych zmian w bazowej gałęzi.
2. Wykonać czyste odtworzenie z repo, testy i pobranie gotowej paczki. Kontrole sprzętowe odnoszą się do konkretnego kandydata wydania, nie nieznanego wcześniejszego buildu.
3. Zamknąć każde P1 z audytu dowodem albo jawnie pozostawić PR niegotowy. Wyjątek zależności nie może ukrywać braku podstawowej funkcji.
4. Sprawdzić macierz: ustawienia, OBS/ATEM/vMix/Roland, Companion HTTP, Web Tally, UDP tally, firmware, tray i zachowanie awarii/reconnect.
5. Sporządzić krótkie podsumowanie: co zmieniono, co przetestowano, ograniczenia i wyjątki. Dopiero wtedy oznaczyć modernizację jako zakończoną i PR gotowy do przeglądu.

Publikacja wydania i scalenie PR są oddzielnymi działaniami; przygotowanie tego planu ich nie wykonuje.

## 6. Wycofywanie zmian i ochrona danych

- Punktem odniesienia pozostaje niezmieniona gałąź PR #1. Zatrzymanie modernizacji nie wymaga jej naprawiania.
- Przy niezaliczonej bramce poprawiamy bieżący etap albo cofamy jego logiczne commity na gałęzi modernizacji. Nie force-pushujemy historii i nie usuwamy dowodów błędów.
- Manifest, lockfile i wymagające ich zmiany API cofamy razem. Nie przywracamy tylko numeru biblioteki przy kodzie korzystającym z nowego API.
- Testy używają tymczasowych konfiguracji. Przed próbą nowego EXE na rzeczywistych ustawieniach wykonujemy kopię. Schematy plików i firmware muszą mieć opisany wpływ na możliwość powrotu do poprzedniego programu.
- Przed wymianą programu na sprzęcie zachowujemy poprzednią paczkę, ustawienia i wersję firmware; nie wgrywamy firmware w ramach samej enumeracji portów.
- Brak sprzętu lub ograniczenie platformy zapisujemy jako otwartą pozycję. Kontynuujemy prace, które od niego nie zależą.

## 7. Jak raportować postęp

Postęp mierzymy zaliczonymi etapami i działającymi ścieżkami użytkownika, nie liczbą commitów ani zielonych jobów. Po każdym etapie raport ma zawierać:

1. Co użytkownik może już zrobić na nowym stosie.
2. Jakie wersje i API faktycznie zmigrowano.
3. Jakim testem to potwierdzono i na jakiej platformie.
4. Co pozostaje blokadą i który następny etap ją usuwa.

Nie podajemy procentu ukończenia ani czasu zakończenia bez podstaw wynikających z E0/E1. Przedłużająca się próba techniczna kończy się opisanym wynikiem i decyzją, zamiast serii kolejnych obejść przedstawianych jako realizacja całego celu.
