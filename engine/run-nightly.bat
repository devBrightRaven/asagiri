@echo off
cd /d C:\Code\asagiri\engine
echo [%date% %time%] Starting Asagiri research... >> research.log
python main.py >> research.log 2>&1
echo [%date% %time%] Research complete. >> research.log
