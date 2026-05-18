// src/styles.ts
export const WIDGET_STYLES = `
  :host {
    --sg-bg: #fafafa;
    --sg-surface: #ffffff;
    --sg-text: #1a1a1a;
    --sg-muted: #888;
    --sg-accent: #6366f1;
    --sg-accent-hover: #4f46e5;
    --sg-border: #e5e5e5;
    --sg-radius: 12px;
    --sg-shadow: 0 8px 32px rgba(0,0,0,0.12);
    font-family: system-ui, -apple-system, sans-serif;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  .sg-draggable {
    user-select: none;
    -webkit-user-select: none;
  }

  .sg-trigger {
    position: fixed;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--sg-accent);
    border: none;
    box-shadow: var(--sg-shadow);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    z-index: 2147483647;
  }
  .sg-trigger:hover { background: var(--sg-accent-hover); }
  .sg-trigger svg { width: 24px; height: 24px; fill: white; }

  .sg-panel {
    position: fixed;
    width: 360px;
    max-height: 480px;
    background: var(--sg-surface);
    border: 1px solid var(--sg-border);
    border-radius: var(--sg-radius);
    box-shadow: var(--sg-shadow);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 2147483647;
    animation: sg-slide-up 0.2s ease-out;
  }

  @keyframes sg-slide-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .sg-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--sg-border);
  }
  .sg-drag-handle {
    cursor: grab;
  }
  .sg-drag-handle:active {
    cursor: grabbing;
  }
  .sg-header-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--sg-text);
  }
  .sg-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--sg-muted);
    font-size: 18px;
    padding: 4px;
    line-height: 1;
  }
  .sg-close:hover { color: var(--sg-text); }

  .sg-popout {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--sg-muted);
    font-size: 14px;
    padding: 4px;
    line-height: 1;
    border-radius: 4px;
    transition: background 0.15s, color 0.15s;
  }
  .sg-popout:hover { color: var(--sg-text); background: rgba(0,0,0,0.05); }

  .sg-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .sg-input-area {
    margin-bottom: 12px;
  }
  .sg-textarea {
    width: 100%;
    min-height: 72px;
    padding: 10px 12px;
    border: 1px solid var(--sg-border);
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    color: var(--sg-text);
    background: var(--sg-bg);
    resize: vertical;
    outline: none;
    transition: border-color 0.15s;
  }
  .sg-textarea:focus { border-color: var(--sg-accent); }
  .sg-textarea::placeholder { color: var(--sg-muted); }

  .sg-submit {
    margin-top: 8px;
    width: 100%;
    padding: 8px 16px;
    background: var(--sg-accent);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
  }
  .sg-submit:hover { background: var(--sg-accent-hover); }
  .sg-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .sg-success {
    color: #16a34a;
    font-size: 13px;
    margin-top: 6px;
    text-align: center;
  }

  .sg-section-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--sg-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 16px 0 8px;
  }

  .sg-recent-item {
    padding: 6px 0;
    font-size: 13px;
    color: var(--sg-text);
    border-bottom: 1px solid var(--sg-border);
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .sg-recent-item:last-child { border-bottom: none; }
  .sg-recent-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--sg-accent);
    flex-shrink: 0;
    margin-top: 5px;
  }
  .sg-recent-content {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sg-recent-type {
    font-size: 11px;
    color: var(--sg-muted);
    flex-shrink: 0;
  }

  .sg-web-preview {
    margin-top: 12px;
    border: 1px dashed var(--sg-border);
    border-radius: 8px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sg-web-preview canvas {
    width: 100%;
    height: 100%;
  }

  .sg-footer {
    padding: 8px 16px;
    border-top: 1px solid var(--sg-border);
    font-size: 12px;
    color: var(--sg-muted);
    text-align: center;
  }

  .sg-error {
    color: #dc2626;
    font-size: 13px;
    margin-top: 6px;
    text-align: center;
  }

  .sg-notice {
    background: #f8f9fc;
    border: 1px solid var(--sg-border);
    border-left: 3px solid #475569;
    border-radius: 4px;
    padding: 12px 14px;
    margin: 8px 0;
    font-size: 13px;
    line-height: 1.55;
    color: #1e293b;
  }
  .sg-notice strong {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 4px;
    color: #0f172a;
  }
  .sg-notice p {
    margin: 0;
    color: #475569;
  }
  .sg-notice a {
    color: #1d4ed8;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .sg-notice a:hover { color: #1e3a8a; }
  .sg-notice a:focus-visible {
    outline: 2px solid #1d4ed8;
    outline-offset: 2px;
    border-radius: 2px;
  }

  /* Drop target visual feedback */
  .sg-drop-active {
    transform: scale(1.3) !important;
    background: #16a34a !important;
    box-shadow: 0 0 24px rgba(22, 163, 74, 0.5) !important;
    transition: transform 0.15s, background 0.15s, box-shadow 0.15s;
  }

  .sg-drop-active-panel {
    outline: 2px dashed #16a34a;
    outline-offset: 2px;
  }

  .sg-drop-zone {
    background: rgba(22, 163, 74, 0.08);
    border: 2px dashed #16a34a;
    border-radius: 8px;
    padding: 24px;
    text-align: center;
    color: #16a34a;
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 12px;
    animation: sg-pulse 1s ease-in-out infinite;
  }

  @keyframes sg-pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
`;
