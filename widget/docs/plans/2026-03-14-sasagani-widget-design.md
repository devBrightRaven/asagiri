# Sasagani Widget — Design Document

> Embeddable quick-capture widget for the Sasagani knowledge web.

## Problem

Sasagani's capture workflow currently requires either navigating to the `/sasagani` page in the Asagiri webapp or installing the Chrome extension. Neither works for embedding into other tools (like NexusForge reports) or sharing with external users.

## Solution

A standalone JavaScript widget that can be embedded in any webpage via a single `<script>` tag. The widget provides zero-friction fragment capture with a small spider web preview.

## Core Decisions

| Decision | Choice |
|----------|--------|
| Deployment | Independent `<script>` tag, embeddable anywhere |
| Primary interaction | Input-focused (large input + small web preview) |
| Classification | Single inbox, zero decisions at capture time |
| API connectivity | Phase 1: connect to Asagiri webapp API |
| Visual style | Neutral, independent from Asagiri color scheme |

## Widget Behavior

### Closed State
- Floating circular button (40x40px) in bottom-right corner
- Spider web icon
- Subtle pulse animation when new connections are discovered

### Open State (360x480px panel)

```
+-------------------------+
| x              sasagani |
+-------------------------+
|                         |
|  +-------------------+  |
|  | Paste URL or       |  |
|  | type anything...   |  |
|  |                    |  |
|  +-------------------+  |
|  [Drop it in]           |
|                         |
|  Recent:                |
|  . AI emotion design    |
|  . yarn-spinner.dev     |
|  . game trigger theory  |
|                         |
|  + - - - - - - - - +   |
|  |  web preview     |   |
|  |    .---.         |   |
|  |   . \ / .        |   |
|  + - - - - - - - - +   |
|                         |
|  23 fragments collected |
+-------------------------+
```

### Interaction Flow

1. User clicks floating button
2. Panel expands with animation
3. User types or pastes URL into input
4. Clicks "Drop it in" or presses Enter
5. Fragment POSTed to API
6. Recent list updates, web preview animates new node
7. User can close panel or keep adding

## Technical Architecture

```
<script src="https://host/widget/sasagani.js"
        data-api="http://localhost:3000">
</script>
    |
    v
Shadow DOM (style isolation)
    |
    v
Preact components (3KB runtime)
    |
    v
POST /api/sasagani/fragments
GET  /api/sasagani/fragments (recent list)
GET  /api/sasagani/connections (web preview)
```

### Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Preact | 3KB, React-compatible API, minimal bundle |
| Build | Vite library mode | Single JS file output, tree-shaking |
| Style isolation | Shadow DOM | No CSS leaks to/from host page |
| Web preview | Canvas 2D | Lightweight, no D3 dependency |
| API | fetch + CORS | Standard, no extra deps |

### Bundle Target

- Total JS: < 30KB gzipped (Preact ~3KB + widget ~15KB + canvas ~5KB)
- No external CSS files (styles injected into Shadow DOM)
- Single `<script>` tag, no dependencies

## Embed API

```html
<!-- Minimal -->
<script src="https://localhost:3000/widget/sasagani.js"></script>

<!-- With config -->
<script
  src="https://localhost:3000/widget/sasagani.js"
  data-api="http://localhost:3000"
  data-position="bottom-right"
></script>
```

### Configuration via data attributes

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-api` | `http://localhost:3000` | Asagiri webapp API base URL |
| `data-position` | `bottom-right` | Button position: bottom-right, bottom-left |

## Webapp Changes Required

1. **CORS middleware** — Allow cross-origin POST/GET to `/api/sasagani/*`
2. **Widget static serving** — Serve `sasagani.js` from `public/widget/`
3. **Fragment source field** — Add `source: "widget"` to distinguish from dashboard/extension

## Project Structure

```
C:/Code/asagiri/widget/
  src/
    index.tsx           # Entry: mount Shadow DOM, render Widget
    Widget.tsx          # Main component (button + panel)
    FragmentInput.tsx   # Text input + submit
    RecentList.tsx      # Recent fragments list
    MiniWeb.tsx         # Canvas spider web preview
    api.ts              # fetch wrapper (POST/GET fragments)
    styles.ts           # CSS-in-JS (injected into Shadow DOM)
  vite.config.ts        # Library mode build
  package.json
  tsconfig.json
  tests/
    Widget.test.tsx
    api.test.ts
    MiniWeb.test.ts
```

## Non-Goals (Phase 1)

- Thread selection in widget
- AI auto-classification
- localStorage / offline mode
- Theme customization API
- Voice input
- Drag-and-drop file upload

## Phase 2 Enhancements

- localStorage fallback + sync when API available
- Background AI classification suggestions (in dashboard, not widget)
- Theme API (`data-theme` attribute)
- Voice input via Web Speech API
