@echo off
REM Asagiri nightly research runner.
REM Registered as Windows Scheduled Task "Asagiri Nightly Research".
REM Uses the new agent-chain path (config.yaml `agents:` section).

set "ASAGIRI_DIR=C:\Code\products\002-asagiri\engine"
set "LOG_FILE=%ASAGIRI_DIR%\research.log"

cd /d "%ASAGIRI_DIR%"

echo. >> "%LOG_FILE%"
echo [%date% %time%] === Asagiri nightly start === >> "%LOG_FILE%"

REM Make sure SearXNG container is up (the engine needs it on localhost:8888)
docker start asagiri-searxng >> "%LOG_FILE%" 2>&1

REM Force UTF-8 for Python stdout/stderr so CLI agent output is decoded cleanly
set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"

REM Pull recent Ideabrowser emails into the Asagiri seed pack before research.
if not defined GOOGLE_WORKSPACE_CLI_CONFIG_DIR set "GOOGLE_WORKSPACE_CLI_CONFIG_DIR=%APPDATA%\gws-chieh"
pwsh -NoProfile -ExecutionPolicy Bypass -File "%ASAGIRI_DIR%\import_ideabrowser_gmail.ps1" >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
  echo [%date% %time%] Ideabrowser seed import failed; continuing without fresh seeds. >> "%LOG_FILE%"
)

python main.py >> "%LOG_FILE%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

echo [%date% %time%] === Asagiri nightly end (exit %EXIT_CODE%) === >> "%LOG_FILE%"
exit /b %EXIT_CODE%
