---
tags: [design, opportunity-radar, startup, cognitive-training]
status: spec
source: claude-code
---

# Opportunity Radar - Design Document

> 認知訓練系統：透過每日自動研究 + 儀式化檢視 + 間隔重複，系統性訓練「看見商業機會」的大腦能力。

## V1 Scope (Layer 1 + Layer 2)

### Research Engine (Python)
- 每晚自動研究 10 個創業 idea，深度分析（1000+ 字/idea）
- Web search + article fetch + Claude analysis
- 交錯學習：每日至少涵蓋 5 個不同領域
- 輸出 Markdown（Obsidian）+ JSON（Webapp）
- 配置驅動：config.yaml 控制策略/領域/深度

### Webapp Dashboard (Next.js + shadcn/ui)

#### Morning Ritual Flow
1. 回顧區 - 間隔重複浮現（1/3/7/30 天前標記的 idea）
2. 今日 10 個新 idea - 卡片式瀏覽
3. 標記最感興趣的 1-3 個（一鍵標記）
4. 連結提問 - 「idea X 和 idea Y 有什麼共通點？」
5. 完成 - Streak +1

#### Dashboard Overview
- 按日期/類別/評分篩選排序
- 累積統計（總 idea 數、覆蓋領域、平均評分）

#### Kanban Board
- 待觀察 / 感興趣 / 深入研究 / 放棄 / 執行

#### Territory Map（累積地圖）
- 領域覆蓋視覺化，越深入顏色越深
- 空白區域引發探索好奇

#### Streak + Gamification
- 連續天數計數器
- 每日最小行動設計

### Data Schema (ideas.json)
```json
{
  "id": "2026-03-07-001",
  "title": "string",
  "domain": "string",
  "one_liner": "string",
  "problem": "string",
  "solution": "string",
  "market_size": "string",
  "competitors": ["string"],
  "moat_analysis": "string",
  "feasibility_score": 1-5,
  "novelty_score": 1-5,
  "sources": ["url"],
  "tags": ["string"],
  "created_at": "ISO8601",
  "user_rating": null | 1-5,
  "user_note": null | "string",
  "review_dates": ["YYYY-MM-DD"],
  "status": "new" | "interested" | "researching" | "passed" | "executing"
}
```

### Folder Structure
```
_startup_radar/
  engine/           # Python research engine
  webapp/           # Next.js dashboard
  data/             # Research output (JSON + MD)
  docs/             # Design docs
  config.yaml       # Research configuration
```

### Tech Stack
- Python 3.11+ (research engine)
- Node.js 20+ / pnpm (webapp)
- Next.js 14 + shadcn/ui + Tailwind CSS
- framer-motion (animations)
- recharts (charts)
- @dnd-kit/core (Kanban drag-drop)
- D3.js (territory map)

### Scheduling
- Windows Task Scheduler, 每晚 23:00

### Portability
- Clone repo + edit config.yaml
- Docker Compose for multi-user
- Vercel deployment option

## Cognitive Science Principles Applied
- Context-Dependent Memory (fixed ritual)
- Spaced Repetition (review queue)
- Elaborative Interrogation (connection prompts)
- Interleaving (5+ domains/day)
- Loss Aversion (streak)
- Endowed Progress Effect (territory map)
