# ESP8266 D1 Mini + WS2812B 4×4 — przygotowanie firmware

**Stan:** dostosowanie źródeł NodeMCU Lua; nie przetestowano jeszcze
na fizycznym D1 Mini. Oryginalny firmware vTally już generuje
kolory WS2812 (plik `tally/src/my-led.lua`), a ten fork zwiększa limit
liczby diod z 10 do 32.

## Docelowe ustawienia CAM1/CAM2/CAM3

Punktem wyjścia jest plik
`tally/examples/d1-mini-ws2812-4x4.ini.example`.

- `operator.ws2812=16 grb`
- `stage.ws2812=0 grb`
- `tally.name=CAM1`, `CAM2` albo `CAM3`
- `hub.ip=` — adres laptopa z vTally w sieci realizacyjnej
- `hub.port=7411` — port UDP vTally, **nie** port HTTP 3000
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

- Działający obraz firmware NodeMCU zawierający `ws2812`, `pwm2`,
  `wifi`, `net` i pozostałe moduły wymagane przez Lua.
- Flashowanie NodeMCU Lua oraz przesłanie plików `.lua/.lc` na D1 Mini.
  Wbudowany flasher spakowanego Windows EXE ma obecnie problem
  z dynamicznym modułem `nodemcu-tool`.
- Zasilanie i start bootstrapa z podłączoną matrycą, kolejność kanałów
  GRB/RGB, rzeczywista jasność i zachowanie po utracie Wi-Fi.

Nie traktować testów na Web Tally jako potwierdzenia poprawnego działania
firmware na płytce.
