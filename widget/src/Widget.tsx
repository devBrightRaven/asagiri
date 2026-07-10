// src/Widget.tsx
import { h } from "preact";
import { render as preactRender } from "preact";
import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { OwnerOnlyError } from "./api";
import { FragmentInput } from "./FragmentInput";
import { RecentList } from "./RecentList";
import { MiniWeb } from "./MiniWeb";
import { useDraggable } from "./useDraggable";
import { WIDGET_STYLES } from "./styles";
import type { Fragment, Connection, ISasaganiAPI } from "./types";

interface Props {
  api: ISasaganiAPI;
  /** True when running against LocalStorageAPI on a public showcase page. */
  demo?: boolean;
}

const REPO_URL = "https://github.com/devBrightRaven/asagiri";

const TRIGGER_SIZE = { width: 48, height: 48 };
const PANEL_SIZE = { width: 360, height: 480 };

// Document Picture-in-Picture support check
const hasPiP = typeof window !== "undefined" && "documentPictureInPicture" in window;

const WEB_ICON = (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="2" fill="white" />
    <path d="M12 2L12 10M12 14L12 22M2 12L10 12M14 12L22 12M4.93 4.93L9.17 9.17M14.83 14.83L19.07 19.07M4.93 19.07L9.17 14.83M14.83 9.17L19.07 4.93" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.6" />
  </svg>
);

export function Widget({ api, demo = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [inboxId, setInboxId] = useState<string | null>(null);
  const [recent, setRecent] = useState<Fragment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [apiError, setApiError] = useState(false);
  const [authError, setAuthError] = useState(false);

  // Draggable: trigger button
  const triggerDrag = useDraggable(
    { x: window.innerWidth - 68, y: window.innerHeight - 68 },
    TRIGGER_SIZE
  );

  // Draggable: panel (header is the drag handle)
  const panelDrag = useDraggable(
    { x: window.innerWidth - 380, y: window.innerHeight - 560 },
    PANEL_SIZE
  );

  const init = useCallback(async () => {
    setLoading(true);
    try {
      const threadId = await api.ensureInboxThread();
      setInboxId(threadId);
      const fragments = await api.getRecentFragments(threadId, 5);
      setRecent(fragments);
      setTotalCount(fragments.length);
      const conns = await api.getConnections();
      setConnections(conns);
      setApiError(false);
      setAuthError(false);
    } catch (err) {
      if (err instanceof OwnerOnlyError) {
        setAuthError(true);
        setApiError(false);
      } else {
        setApiError(true);
        setAuthError(false);
      }
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (isOpen && !inboxId) {
      init();
    }
  }, [isOpen, inboxId, init]);

  const handleSubmit = async (content: string) => {
    if (!inboxId) throw new Error("Not connected");

    const isUrl = /^https?:\/\//i.test(content);
    const type = isUrl ? "url" : "text";

    const fragment = await api.addFragment(inboxId, type, content);
    setRecent((prev) => [fragment, ...prev].slice(0, 5));
    setTotalCount((c) => c + 1);
  };

  // --- Picture-in-Picture: pop out to floating desktop window ---
  const [isPiP, setIsPiP] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);

  const handlePopOut = async () => {
    if (!hasPiP) return;
    try {
      // @ts-ignore — documentPictureInPicture is not yet in TS types
      const pipWindow = await documentPictureInPicture.requestWindow({
        width: 380,
        height: 520,
      });
      pipWindowRef.current = pipWindow;

      // Inject styles into PiP window
      const style = pipWindow.document.createElement("style");
      style.textContent = `
        body {
          margin: 0; padding: 0;
          font-family: system-ui, -apple-system, sans-serif;
          background: #ffffff;
          overflow: hidden;
        }
        ${WIDGET_STYLES.replace(/:host/g, "body")}
        .sg-panel {
          position: static !important;
          width: 100% !important;
          max-height: 100vh !important;
          height: 100vh !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          animation: none !important;
        }
        .sg-drag-handle { cursor: default !important; }
        .sg-header { background: #f5f5f5; }
      `;
      pipWindow.document.head.appendChild(style);

      // Create container and render widget panel content
      const container = pipWindow.document.createElement("div");
      pipWindow.document.body.appendChild(container);

      // Render a standalone panel into PiP window
      const PiPPanel = () => (
        h("div", { class: "sg-panel", role: "dialog" },
          h("div", { class: "sg-header" },
            h("span", { class: "sg-header-title" }, "sasagani"),
            h("button", {
              class: "sg-close",
              onClick: () => pipWindow.close(),
              "aria-label": "Close",
            }, "\u00d7")
          ),
          h("div", { class: "sg-body" },
            authError
              ? h("div", { class: "sg-notice", role: "status" },
                  h("strong", null, "Owner-only sasagani."),
                  h("p", null,
                    "This is the owner's personal capture inbox. To use sasagani for yourself, ",
                    h("a", { href: REPO_URL, target: "_blank", rel: "noopener" }, "clone the repo"),
                    " and run your own instance."
                  )
                )
              : apiError
              ? h("p", { class: "sg-error" }, "Cannot connect to API.")
              : h("div", null,
                  h(FragmentInput, { onSubmit: handleSubmit, disabled: loading || !inboxId }),
                  h(RecentList, { fragments: recent }),
                  recent.length > 0 && h(MiniWeb, { fragments: recent, connections })
                )
          ),
          h("div", { class: "sg-footer" },
            demo
              ? totalCount > 0
                ? `Demo · ${totalCount} fragment${totalCount === 1 ? "" : "s"} in this browser`
                : "Demo mode — try dropping a URL or typing"
              : totalCount > 0
              ? `${totalCount} fragment${totalCount === 1 ? "" : "s"} collected`
              : "Start capturing"
          )
        )
      );

      preactRender(h(PiPPanel, null), container);

      setIsPiP(true);
      setIsOpen(false); // Close inline panel

      // Listen for PiP window close
      pipWindow.addEventListener("pagehide", () => {
        setIsPiP(false);
        pipWindowRef.current = null;
      });
    } catch (err) {
      console.error("PiP failed:", err);
    }
  };

  const handleTriggerClick = () => {
    if (!triggerDrag.wasDragged) {
      setIsOpen(true);
    }
  };

  // --- Drag & Drop: accept dropped URLs, text, links, images ---
  const [dropActive, setDropActive] = useState(false);
  const [dropStatus, setDropStatus] = useState<"idle" | "success" | "error">("idle");

  const extractDropContent = (e: DragEvent): string | null => {
    const dt = e.dataTransfer;
    if (!dt) return null;

    // Priority: URI list > plain text
    const uri = dt.getData("text/uri-list");
    if (uri) {
      // uri-list can have multiple lines; take first non-comment
      const firstUrl = uri.split("\n").find((l) => l.trim() && !l.startsWith("#"));
      if (firstUrl) return firstUrl.trim();
    }

    const text = dt.getData("text/plain");
    if (text && text.trim()) return text.trim();

    return null;
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    setDropActive(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDropActive(false);
  };

  const handleDropOnTrigger = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);

    const content = extractDropContent(e);
    if (!content) return;

    // Auto-open and submit
    setIsOpen(true);

    // Ensure init has run
    if (!inboxId) {
      await init();
    }

    try {
      await handleSubmit(content);
      setDropStatus("success");
      setTimeout(() => setDropStatus("idle"), 2000);
    } catch {
      setDropStatus("error");
      setTimeout(() => setDropStatus("idle"), 2000);
    }
  };

  const handleDropOnPanel = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);

    const content = extractDropContent(e);
    if (!content) return;

    try {
      await handleSubmit(content);
      setDropStatus("success");
      setTimeout(() => setDropStatus("idle"), 2000);
    } catch {
      setDropStatus("error");
      setTimeout(() => setDropStatus("idle"), 2000);
    }
  };

  return (
    <div>
      {!isOpen && (
        <button
          class={`sg-trigger sg-draggable ${dropActive ? "sg-drop-active" : ""}`}
          style={{
            left: `${triggerDrag.position.x}px`,
            top: `${triggerDrag.position.y}px`,
            cursor: triggerDrag.isDragging ? "grabbing" : "grab",
          }}
          onMouseDown={triggerDrag.handleMouseDown}
          onClick={handleTriggerClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDropOnTrigger}
          aria-label="Open Sasagani capture — drag content here to capture"
        >
          {WEB_ICON}
        </button>
      )}

      {isOpen && (
        <div
          class={`sg-panel sg-draggable ${dropActive ? "sg-drop-active-panel" : ""}`}
          style={{
            left: `${panelDrag.position.x}px`,
            top: `${panelDrag.position.y}px`,
          }}
          role="dialog"
          aria-label="Sasagani capture"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDropOnPanel}
        >
          <div
            class="sg-header sg-drag-handle"
            onMouseDown={panelDrag.handleMouseDown}
            style={{ cursor: panelDrag.isDragging ? "grabbing" : "grab" }}
          >
            <span class="sg-header-title">sasagani</span>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              {hasPiP && (
                <button
                  class="sg-popout"
                  onClick={handlePopOut}
                  aria-label="Pop out to floating window"
                  title="Pop out"
                >
                  &#x2197;
                </button>
              )}
              <button class="sg-close" onClick={() => setIsOpen(false)} aria-label="Close">
                &times;
              </button>
            </div>
          </div>

          <div class="sg-body">
            {dropActive && (
              <div class="sg-drop-zone">Drop here to capture</div>
            )}
            {dropStatus === "success" && (
              <p class="sg-success">Dropped & captured!</p>
            )}
            {dropStatus === "error" && (
              <p class="sg-error">Drop failed — is the API running?</p>
            )}
            {authError && !dropActive ? (
              <div class="sg-notice" role="status">
                <strong>Owner-only sasagani.</strong>
                <p>
                  This is the owner's personal capture inbox.
                  To use sasagani for yourself,{" "}
                  <a href={REPO_URL} target="_blank" rel="noopener">
                    clone the repo
                  </a>{" "}
                  and run your own instance.
                </p>
              </div>
            ) : apiError && !dropActive ? (
              <p class="sg-error">Cannot connect to API. Is the Asagiri webapp running?</p>
            ) : (
              <>
                <FragmentInput onSubmit={handleSubmit} disabled={loading || !inboxId} />
                <RecentList fragments={recent} />
                {recent.length > 0 && (
                  <MiniWeb fragments={recent} connections={connections} />
                )}
              </>
            )}
          </div>

          <div class="sg-footer">
            {demo
              ? totalCount > 0
                ? `Demo · ${totalCount} fragment${totalCount === 1 ? "" : "s"} in this browser`
                : "Demo mode — try dropping a URL or typing"
              : totalCount > 0
              ? `${totalCount} fragment${totalCount === 1 ? "" : "s"} collected`
              : "Start capturing"}
          </div>
        </div>
      )}
    </div>
  );
}
