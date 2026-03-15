@echo off
cd /d D:\Obsidian\br-os-vault\_startup_radar\engine
echo Testing Gemini API key...
python -c "from dotenv import load_dotenv; load_dotenv(); from researcher import create_provider, load_config, research_idea; from pathlib import Path; config = load_config(Path('D:/Obsidian/br-os-vault/_startup_radar/config.yaml')); provider = create_provider(config); idea = research_idea(provider, 'AI/ML', 'test-001', '2026-03-08'); print(f'Title: {idea.title}'); print(f'One-liner: {idea.one_liner}'); print('SUCCESS!')"
echo.
pause
