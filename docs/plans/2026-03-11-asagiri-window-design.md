# Sasagani（ささがに）— 靈感發酵槽

> 設計日期：2026-03-11

## 問題

研究過程中的直覺和靈感散落在不同的 LLM 對話、瀏覽器分頁、腦袋裡，沒有一個地方讓它們互相碰撞、發酵。同時注意力容易發散，需要一個機制限制同時進行的方向。

### 現有工具的不足

- **NotebookLM**：可以丟來源進去合成，但不整合 asagiri pipeline，也沒有「線」的限制機制
- **ChatGPT / Claude Desktop**：全域快捷鍵可以快速問問題，但每次對話是獨立的，靈感不會累積發酵
- **Raindrop / Pocket**：收藏但不合成

### 差異化

Asagiri Window 的獨特價值在於：
1. 靈感之間會**自動長出連結**（菌絲），不是被動存檔
2. **三條線硬限制**強制聚焦
3. 與 asagiri 生態系統整合 — 發酵成熟的靈感可以推進成 idea，進入 Kanban/dashboard

## 核心概念

不是分析工具，不是書籤管理器。是一個讓半成形的直覺互相找到彼此的地方 — 丟東西進去，菌絲自己長，連結自己黏。

## 設計

### 三條線（硬限制）

- 最多 3 條同時活躍的發酵線
- 每條線是一個容器，收集相關的靈感碎片
- 要開第 4 條，必須先把一條歸檔或推進成 asagiri idea
- 線的邊界是模糊的 — 系統會提示「這個跟線 A 還是線 B 有關？還是兩條都有？」
- 碎片可以同時屬於多條線

### 輸入（零摩擦）

接受任何形態，不限制格式：
- **URL** — 網頁、GitHub repo、YouTube 影片，自動擷取內容
- **文字片段** — 一句話、一段想法、一個問題
- **語音** — 語音轉文字（Phase 2）
- **註記（可選）** — 附上「這讓我想到 X」或不附都行

輸入方式：
- 瀏覽器擴充套件快捷鍵呼出 popup
- webapp 頁面內直接輸入

### 發酵（AI 背景運作）

- 每次有新輸入，AI 重新掃描該線（及跨線）的所有碎片
- 尋找碎片之間的潛在連結 — 不是分析報告，而是標記「這兩個東西之間好像有什麼」
- 跨線連結也會被發現並標記
- 連結強度隨時間和新證據變化 — 越多碎片支持同一個連結，菌絲越粗

### 輸出（三層）

1. **通知** — 發現新連結時輕量推送（瀏覽器通知 / 擴充套件 badge），不打斷工作流
2. **全貌** — 打開 `/window` 頁面時看到每條線的當前狀態，哪些碎片結得比較緊
3. **菌絲圖** — D3.js 視覺化靈感之間的連結網絡，密度 = 成熟度

### 與 asagiri 的整合

**手動推進（A）**：
- 當一團靈感結得夠緊，使用者手動把它推成 asagiri 格式的 idea
- 系統預填欄位（標題、問題、解法、市場、可行性...），使用者確認/修改
- 進入 Kanban pipeline

**反向餵養（C）**：
- asagiri engine 每日 10 個 idea 可以被拉進發酵槽
- 跟手動丟的碎片混在一起長菌絲
- 在 dashboard / ritual flow 中加入「丟進發酵槽」的按鈕

## 技術架構

### Phase 1：瀏覽器擴充套件 + webapp 頁面

**瀏覽器擴充套件（Chrome Extension Manifest V3）**
- 快捷鍵呼出 popup
- popup 內容：輸入框 + 線選擇器（3 條線）+ 送出
- 自動偵測當前頁面 URL，一鍵擷取
- 呼叫 asagiri webapp API 送出碎片

**webapp 新增**
- `/window` 頁面 — 主介面
- `POST /api/window/fragments` — 新增碎片
- `GET /api/window/threads` — 取得所有線及其碎片
- `POST /api/window/threads` — 建立/歸檔線
- `POST /api/window/promote` — 推進為 asagiri idea
- `GET /api/window/connections` — 取得 AI 發現的連結

**資料儲存**
- `data/window/threads.json` — 線的元資料
- `data/window/fragments.json` — 所有碎片
- `data/window/connections.json` — AI 發現的連結
- `data/window/content-cache/` — URL 擷取的內容快取

**AI 發酵引擎**
- 新碎片進來時觸發
- 使用 LLM 比對碎片之間的潛在關聯
- 結果寫入 connections.json

### Phase 2（如果需要）：Tauri 全域 app

- 取代瀏覽器擴充套件，提供全域快捷鍵
- 語音輸入支援
- 系統層級通知
- webapp 部分完全不動

## 技術棧

- 前端：Next.js + React（與現有 webapp 統一）
- 視覺化：D3.js（與 territory map 共用）
- 動畫：Framer Motion（與現有一致）
- 擴充套件：Chrome Extension Manifest V3
- AI：與 asagiri engine 共用 LLM 設定（Gemini / Claude）
- 資料：file-based JSON（與現有一致）
