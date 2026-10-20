# ESP8266 D1 Mini + WS2812B 4×4 — przygotowanie firmware

**Stan:** sprawdzone na sprzęcie 2026-10-19 (dwie płytki ESP8266 z NodeMCU 3.0,
matryca 4×4 WS2812B, kolejność GRB): wgrywanie, zapis ustawień, restart,
ponowne wykrycie i kolory Program/Preview/UNKNOWN po sieci. Oryginalny firmware
vTally już generuje kolory WS2812 (plik `tally/src/my-led.lua`), a ten fork
zwiększa limit liczby diod z 10 do 32.

## Docelowe ustawienia CAM1/CAM2/CAM3

Punktem wyjścia jest plik
`tally/examples/d1-mini-ws2812-4x4.ini.example`.

- `operator.ws2812=16 grb`
- `stage.ws2812=0 grb`
- `tally.name=CAM1`, `CAM2` albo `CAM3`
- `hub.ip=` — adres laptopa z GC Tally Hub w sieci realizacyjnej
- `hub.port=7411` — port UDP GC Tally, **nie** port HTTP 3000
- Każde tally przypisujemy do kanału 1, 2 lub 3 w Hubie.

Matryca 4×4 jest traktowana jako **łańcuch 16 pikseli w jednym kolorze**:
PROGRAM czerwony, PREVIEW zielony, UNKNOWN niebieski migający
(stan fizyczny programu jest wtedy nieznany). Nie ma indywidualnych
efektów per piksel.

## Połączenie sprzętowe planowane do weryfikacji

W oryginalnym vTally `ws2812.init(ws2812.MODE_SINGLE)` korzysta
z **D4 / GPIO2** na NodeMCU/ESP8266. D4 jest pinem bootstrapowym,
więc zewnętrzny układ nie może wymuszać LOW przy starcie ESP8266.
Zasilaj matrycę stabilnym **5 V**, połącz masy z D1 Mini i nie zasilaj
16 WS2812B z linii **3,3 V**. Przy pełnym białym 16 × 60 mA
to prawie 1 A (tally zwykle będzie pobierać mniej). Przy niestabilnym
sygnale 3,3 V → WS2812B rozważ konwerter logiczny na 5 V.

## Co jeszcze wymaga potwierdzenia

- Zachowanie przy dłuższej utracie Wi-Fi i zasilaniu z powerbanku na planie.
- Jasność i pobór prądu przy pełnej jasności 16 diod.

## Dwa etapy przygotowania nowej płytki

Wbudowany flasher GC Tally **nie wgrywa bazowego obrazu firmware ESP8266**.
Do nowej płytki trzeba najpierw wgrać odpowiednią wersję
**NodeMCU Lua firmware** z modułami wymaganymi przez projekt
(`file`, `gpio`, `net`, `node`, `pwm2`, `tmr`, `wifi`, `ws2812`).
Na Windows służy do tego `flash-nodemcu.cmd` z paczki
`gc-tally-windows-*.zip` (zawiera esptool i obraz
`nodemcu-3.0-master_20200610-cfe68233-float.bin`); opis w `START-TUTAJ.txt`.

Dopiero do uruchomionego firmware NodeMCU Lua wgrywamy **pliki aplikacji**:
`init.lua` + `my-*.lua` (lub prekompilowane `my-*.lc`).
Ten drugi etap obsługuje flasher w GC Tally Hub. Osobno zapisujemy
`tally-settings.ini` (Wi-Fi, nazwa CAM, IP Huba i UDP 7411).

Przy Windowsowej wersji standalone skopiuj **cały** katalog
`dist/esp8266` razem z `dist/gc-tally.exe` w tym samym folderze nadrzędnym.
Nie kopiuj samego EXE bez katalogu firmware.

Na nowej płytce sprawdź kolejno: odczyt informacji o NodeMCU,
wgranie kompletu Lua, zapisanie ustawień, restart, połączenie z Wi-Fi,
odebranie UDP 7411 z Huba i zmianę kolorów WS2812B.
