@echo off
cd /d D:\Obsidian\br-os-vault\_startup_radar\engine
echo [%date% %time%] Starting Asagiri research... >> research.log
python main.py >> research.log 2>&1
echo [%date% %time%] Research complete. >> research.log
