@echo off
title Asagiri
echo === Asagiri ===
echo.

cd /d C:\Code\asagiri\webapp

:: Clean stale lock file
del /f ".next\dev\lock" >nul 2>&1

echo Starting webapp on http://localhost:3000 ...
echo Press Ctrl+C to stop.
echo.

start "" wscript //nologo "C:\Code\asagiri\open-browser.vbs"
pnpm dev
