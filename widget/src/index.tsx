// src/index.tsx
import { render, h } from "preact";
import { Widget } from "./Widget";
import { SasaganiAPI } from "./api";
import { LocalStorageAPI } from "./localStorageAPI";
import { WIDGET_STYLES } from "./styles";
import type { ISasaganiAPI } from "./types";

function mount() {
  const script = document.querySelector(
    'script[src*="sasagani"]'
  ) as HTMLScriptElement | null;

  // Mode selection from <script data-api="…">:
  //   - missing OR "demo"     -> LocalStorageAPI (showcase / public pages)
  //   - any URL               -> SasaganiAPI hitting that webapp
  // No localhost default: an unconfigured embed becomes a demo instead of
  // breaking against a port that happens to be open.
  const apiBase = script?.dataset.api?.trim() || "";
  const isDemo = !apiBase || apiBase.toLowerCase() === "demo";

  const host = document.createElement("div");
  host.id = "sasagani-widget-host";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = WIDGET_STYLES;
  shadow.appendChild(styleEl);

  const container = document.createElement("div");
  shadow.appendChild(container);

  const api: ISasaganiAPI = isDemo
    ? new LocalStorageAPI()
    : new SasaganiAPI(apiBase);

  render(h(Widget, { api, demo: isDemo }), container);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
