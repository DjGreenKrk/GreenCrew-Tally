@echo off
rem Wgrywa bazowy firmware NodeMCU na nowa plytke ESP8266 (raz na plytke).
rem Uzycie: dwuklik albo "flash-nodemcu.cmd COM11".
setlocal EnableExtensions
cd /d "%~dp0"
title vTally - pierwsze wgranie NodeMCU na ESP8266

set "ESPTOOL=%~dp0tools\esptool\esptool.exe"
set "FIRMWARE=%~dp0firmware\nodemcu-3.0-master_20200610-cfe68233-float.bin"

if not exist "%ESPTOOL%" (
    echo Brak pliku tools\esptool\esptool.exe - rozpakuj caly ZIP, nie tylko ten skrypt.
    goto :fail
)
if not exist "%FIRMWARE%" (
    echo Brak pliku firmware\nodemcu-3.0-master_20200610-cfe68233-float.bin - rozpakuj caly ZIP.
    goto :fail
)

echo.
echo  Ten skrypt KASUJE cala pamiec ESP8266 i wgrywa czysty NodeMCU.
echo  Potem aplikacje lampki i ustawienia wgrasz z vTally Hub, strona Flash.
echo.
echo  Zamknij strone Flash w vTally i inne programy uzywajace portu COM.
echo.

set "PORT=%~1"
if defined PORT goto :haveport
echo Porty szeregowe w tym komputerze:
powershell -NoProfile -Command "$p = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\(COM\d+\)' }; if ($p) { $p | ForEach-Object { '   ' + $_.Name } } else { '   (brak - sprawdz kabel USB i sterownik adaptera)' }"
echo.
set /p "PORT=Podaj port ESP (np. COM11): "
:haveport
if not defined PORT (
    echo Nie podano portu.
    goto :fail
)
rem "11" -> "COM11"
echo %PORT%| findstr /r /i "^COM[0-9][0-9]*$" >nul || set "PORT=COM%PORT%"
echo %PORT%| findstr /r /i "^COM[0-9][0-9]*$" >nul || (
    echo "%PORT%" nie wyglada na port COM.
    goto :fail
)

echo.
echo === Sprawdzam plytke na %PORT% ===
"%ESPTOOL%" --chip esp8266 --port %PORT% flash_id
if errorlevel 1 (
    echo.
    echo Nie udalo sie polaczyc z ESP8266 na %PORT%.
    echo  - sprawdz, czy to wlasciwy port i czy zaden program go nie uzywa,
    echo  - goly modul bez auto-resetu: przytrzymaj GPIO0 przy masie ^(przycisk FLASH^),
    echo    nacisnij RST, uruchom skrypt ponownie i pusc GPIO0 po "Connecting...".
    goto :fail
)

echo.
set "BACKUP="
set /p "BACKUP=Zrobic kopie obecnej zawartosci (ok. 1-2 min)? [t/N]: "
if /i not "%BACKUP%"=="t" goto :nobackup
if not exist "%~dp0backup" mkdir "%~dp0backup"
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%t"
set "BACKUPFILE=%~dp0backup\esp8266-%PORT%-%STAMP%.bin"
"%ESPTOOL%" --chip esp8266 --port %PORT% --baud 460800 read_flash 0 ALL "%BACKUPFILE%"
if errorlevel 1 (
    echo Kopia nie powiodla sie - przerywam, nic nie zostalo skasowane.
    goto :fail
)
echo Kopia zapisana: %BACKUPFILE%
:nobackup

echo.
set "CONFIRM="
set /p "CONFIRM=Skasowac ESP na %PORT% i wgrac NodeMCU? Wpisz TAK: "
if /i not "%CONFIRM%"=="TAK" (
    echo Przerwano, nic nie zostalo zmienione.
    goto :fail
)

echo.
echo === Kasowanie pamieci ===
"%ESPTOOL%" --chip esp8266 --port %PORT% erase_flash
if errorlevel 1 goto :flashfail

echo.
echo === Wgrywanie NodeMCU ===
"%ESPTOOL%" --chip esp8266 --port %PORT% --baud 460800 write_flash -fm dio 0x00000 "%FIRMWARE%"
if not errorlevel 1 goto :done
echo Ponawiam wolniej (115200)...
"%ESPTOOL%" --chip esp8266 --port %PORT% --baud 115200 write_flash -fm dio 0x00000 "%FIRMWARE%"
if errorlevel 1 goto :flashfail

:done
echo.
echo  Gotowe. NodeMCU jest wgrany.
echo  1. Odczekaj ok. 30 s - przy pierwszym starcie NodeMCU formatuje pamiec.
echo  2. W vTally Hub otworz strone Flash i kliknij "Update now".
echo  3. Uzupelnij ustawienia ^(Wi-Fi, Hub IP, nazwa^) i kliknij Save.
echo  Szczegoly: START-TUTAJ.txt
echo.
pause
exit /b 0

:flashfail
echo.
echo Wgrywanie nie powiodlo sie. Plytka nie ma teraz dzialajacego firmware -
echo uruchom skrypt jeszcze raz ^(ewentualnie z GPIO0 przy masie, patrz wyzej^).
:fail
echo.
pause
exit /b 1
