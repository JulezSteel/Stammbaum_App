@echo off
REM ============================================================
REM  Familienbaum launcher
REM  Doppelklick startet die App und oeffnet den Browser.
REM  Erstellt automatisch von Claude.
REM ============================================================
title Familienbaum starten...

set "PROJ=C:\Users\j.stahl\Claude Coding\familienbaum"
cd /d "%PROJ%"

REM --- 1) Node.js finden (zuerst WinGet-Installation, dann NodeTool) ---
set "NODE="
for /f "delims=" %%F in ('dir /b /s "C:\Users\j.stahl\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_*\node.exe" 2^>nul') do (
    if not defined NODE set "NODE=%%F"
)
if not defined NODE if exist "C:\Users\j.stahl\Downloads\NodeTool\node.exe" set "NODE=C:\Users\j.stahl\Downloads\NodeTool\node.exe"

if not defined NODE (
    echo.
    echo  FEHLER: Node.js wurde nicht gefunden.
    echo  Bitte Julian / Claude Bescheid geben.
    echo.
    pause
    exit /b 1
)

set "NEXT=%PROJ%\node_modules\next\dist\bin\next"

REM --- 2) Laeuft die App schon? Dann nur den Browser oeffnen. ---
REM  Hinweis: Wir suchen die Listening-Adresse "0.0.0.0:3000" statt des Wortes
REM  "LISTENING" - der Status heisst auf Deutsch "ABHOEREN". Die Adresse ist
REM  in jeder Sprache gleich.
netstat -an | findstr "0.0.0.0:3000 [::]:3000" >nul 2>&1
if not errorlevel 1 (
    echo Familienbaum laeuft bereits - oeffne Browser...
    start "" "http://localhost:3000"
    exit /b 0
)

REM --- 3) Server in eigenem, minimiertem Fenster starten ---
echo Starte den Familienbaum-Server...
start "Familienbaum Server - zum Beenden dieses Fenster schliessen" /min "%NODE%" "%NEXT%" start

REM --- 4) Warten, bis Port 3000 bereit ist (max. ~40 Sekunden) ---
echo Einen Moment bitte, die App wird gestartet...
set /a TRIES=0
:wait
ping -n 2 127.0.0.1 >nul
netstat -an | findstr "0.0.0.0:3000 [::]:3000" >nul 2>&1
if not errorlevel 1 goto ready
set /a TRIES+=1
if %TRIES% GEQ 20 (
    echo.
    echo  Der Server braucht ungewoehnlich lange. Bitte dieses Fenster schliessen
    echo  und das Familienbaum-Symbol erneut anklicken. Hilft das nicht: Julian / Claude.
    echo.
    pause
    exit /b 1
)
goto wait

:ready
REM --- 5) Browser oeffnen ---
echo Fertig! Oeffne den Familienbaum im Browser...
start "" "http://localhost:3000"
exit /b 0
