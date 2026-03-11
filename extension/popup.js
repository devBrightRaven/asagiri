const API_BASE = "http://localhost:3000/api/sasagani";

let selectedThreadId = null;

// --- DOM refs ---

const threadsContainer = document.getElementById("threads");
const contentInput = document.getElementById("content-input");
const noteInput = document.getElementById("note-input");
const submitBtn = document.getElementById("submit-btn");
const captureBtn = document.getElementById("capture-btn");
const statusEl = document.getElementById("status");

// --- Threads ---

async function loadThreads() {
  try {
    const res = await fetch(`${API_BASE}/threads`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const threads = await res.json();

    threadsContainer.innerHTML = "";
    threads.forEach((thread, i) => {
      const btn = document.createElement("button");
      btn.className = "thread-btn";
      btn.type = "button";
      btn.role = "radio";
      btn.textContent = thread.title || thread.name || `Thread ${thread.id}`;
      btn.dataset.threadId = thread.id;
      btn.setAttribute("aria-checked", i === 0 ? "true" : "false");

      btn.addEventListener("click", () => selectThread(thread.id));

      threadsContainer.appendChild(btn);
    });

    if (threads.length > 0) {
      selectedThreadId = threads[0].id;
    }
  } catch (err) {
    showStatus(`載入失敗: ${err.message}`);
  }
}

function selectThread(id) {
  selectedThreadId = id;
  const buttons = threadsContainer.querySelectorAll(".thread-btn");
  buttons.forEach((btn) => {
    btn.setAttribute(
      "aria-checked",
      btn.dataset.threadId === String(id) ? "true" : "false"
    );
  });
}

// --- Type detection ---

function detectType(text) {
  try {
    const url = new URL(text);
    if (url.protocol === "http:" || url.protocol === "https:") return "url";
  } catch {
    // not a URL
  }
  return "text";
}

// --- Submit ---

async function submit(content, note) {
  if (!content.trim()) {
    showStatus("請輸入內容");
    return;
  }
  if (selectedThreadId == null) {
    showStatus("請先選擇一條線");
    return;
  }

  try {
    const body = {
      thread_id: selectedThreadId,
      content: content.trim(),
      type: detectType(content.trim()),
    };
    if (note && note.trim()) {
      body.note = note.trim();
    }

    const res = await fetch(`${API_BASE}/fragments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    contentInput.value = "";
    noteInput.value = "";
    showStatus("已丟入蛛網");
  } catch (err) {
    showStatus(`失敗: ${err.message}`);
  }
}

// --- Status ---

function showStatus(msg) {
  statusEl.textContent = msg;
  clearTimeout(showStatus._timer);
  showStatus._timer = setTimeout(() => {
    statusEl.textContent = "";
  }, 2000);
}

// --- Capture current tab ---

async function captureCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab && tab.url) {
      contentInput.value = tab.url;
      contentInput.focus();
    }
  } catch (err) {
    showStatus(`擷取失敗: ${err.message}`);
  }
}

// --- Event listeners ---

submitBtn.addEventListener("click", () => {
  submit(contentInput.value, noteInput.value);
});

captureBtn.addEventListener("click", captureCurrentTab);

contentInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    submit(contentInput.value, noteInput.value);
  }
});

// --- Init ---

loadThreads();
