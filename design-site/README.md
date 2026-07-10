# design-site — Asagiri showcase

Static four-page showcase of the Asagiri stack: Overview, Engine, Webapp,
Widget. Plus three exploratory design directions kept under `explore/`.

Deployed via Cloudflare Pages. No build step. Pure HTML + CSS + one
self-hosted widget bundle.

## Local preview

```bash
cd design-site
python -m http.server 5555
# → http://localhost:5555/
```

## Cloudflare Pages deploy (GitHub-integrated)

1. **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.**
2. Pick the `devBrightRaven/asagiri` repo, branch `refactor/thin-orchestrator`
   (or `master` after merge).
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave blank — no build step)*
   - **Build output directory:** `design-site`
   - **Root directory:** *(leave blank)*
4. Add a custom domain when ready (e.g. `lab.brightraven.world/asagiri/` or
   a fresh subdomain). Cloudflare auto-provisions the TLS certificate.

Cloudflare Pages picks up `_headers` and `_redirects` automatically from
the publish dir.

## Configuration files

| File | Purpose |
|---|---|
| `_headers` | Cloudflare Pages security headers + cache control |
| `_redirects` | Clean URLs (`/architecture` → `/architecture.html`) |
| `assets/tokens.css` | Morning mist color tokens (light + dark + high-contrast) |
| `assets/shared.css` | Layout, typography, mist animation, glass cards |
| `assets/sasagani.js` | Widget bundle (copy of `widget/dist/sasagani.js`) |

## Pages

| Path | Purpose |
|---|---|
| `index.html` | Overview, three surfaces, design principles |
| `architecture.html` | Engine layer diagram, dispatch chain, failure modes, tests |
| `webapp.html` | Next.js dashboard description with five screenshots |
| `widget.html` | Sasagani widget demo (live bundle embedded) |
| `explore/index.html` | Three exploratory design directions, B chosen |

## Theme

Direction B — 流霧 Ryūmu (drifting mist).

- Pre-dawn steel-blue background (`oklch(0.94 0.014 235)` light,
  `oklch(0.14 0.020 245)` dark)
- Three SVG-noise mist layers drift at 60s / 90s / 120s loops
- Glass-style cards with `backdrop-filter` + dew droplet on hover
- Headings breathe (letter-spacing oscillation 8s)
- All animations respect `prefers-reduced-motion`
- WCAG AA contrast in light, dark, and high-contrast modes

## A11y notes

- Skip link on every page
- All decorative SVG (mist + diagrams) marked `aria-hidden="true"`
- SVG diagrams that carry meaning have `<title>` and `<desc>`
- All images have descriptive alt text
- Semantic landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`)
- Tables have captions; headers use `<th scope>`
- Native interactive elements only — no `<div onclick>`
- Touch targets ≥ 44px (nav links)
- Validated against the project's a11y hook on every CSS/HTML edit
