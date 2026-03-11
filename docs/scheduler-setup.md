---
tags: [setup, opportunity-radar, scheduler]
status: reference
source: claude-code
---

# Windows Task Scheduler Setup

## Prerequisites
- Python 3.11+ installed and in PATH
- `pip install -r engine/requirements.txt` completed
- `.env` file created in `engine/` with `ANTHROPIC_API_KEY`

## Setup Steps

1. Open Task Scheduler (Win+R -> `taskschd.msc`)

2. Click "Create Basic Task..."
   - Name: `Asagiri - Nightly Research`
   - Description: `Researches 10 startup ideas daily using Claude API`

3. Trigger: Daily at 23:00

4. Action: Start a Program
   - Program: `D:\Obsidian\br-os-vault\_startup_radar\engine\run-nightly.bat`
   - Start in: `D:\Obsidian\br-os-vault\_startup_radar\engine`

5. Properties (after creation, right-click -> Properties):
   - General: "Run whether user is logged on or not"
   - Conditions: Check "Start only if the following network connection is available" -> Any
   - Settings: Check "If the task fails, restart every 10 minutes, up to 3 times"

## Verify

Run manually first:
```
cd D:\Obsidian\br-os-vault\_startup_radar\engine
python main.py --dry-run
```

Check logs:
```
type D:\Obsidian\br-os-vault\_startup_radar\engine\research.log
```

## Cost Estimate

Each nightly run calls Claude API ~10 times with web search.
Approximate cost: $0.50-1.00/day (Sonnet with web search).
Monthly: ~$15-30.
