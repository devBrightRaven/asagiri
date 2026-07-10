/* =========================================================================
 * Asagiri — Variant A · 朝霧捲軸
 * Vanilla JS. Drives:
 *   1. The generation-demo replay (agent-chain step log + idea-card reveal)
 *   2. The admin gate (client-side DEMO stub only)
 *   3. Owner actions per card → native <dialog> confirm → role=status toast
 *
 * Runs 100% client-side off the embedded ideas JSON. No backend calls.
 * ========================================================================= */
(function () {
  "use strict";

  // --- Read embedded real data -------------------------------------------
  var dataEl = document.getElementById("ideas-data");
  var DATA = { ideas: [] };
  try {
    DATA = JSON.parse(dataEl.textContent);
  } catch (e) {
    console.error("Failed to parse embedded ideas JSON", e);
  }
  var IDEAS = DATA.ideas || [];

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // --- Element refs -------------------------------------------------------
  var watchBtn = document.getElementById("watch-btn");
  var resetBtn = document.getElementById("reset-btn");
  var runLog = document.getElementById("run-log");
  var runStatus = document.getElementById("run-status");
  var runStatusText = document.getElementById("run-status-text");
  var runCount = document.getElementById("run-count");
  var progressFill = document.getElementById("progress-fill");
  var ideasStream = document.getElementById("ideas-stream");
  var toastRegion = document.getElementById("toast-region");
  var confirmDialog = document.getElementById("confirm-dialog");
  var dialogTarget = document.getElementById("dialog-target");
  var dialogConfirm = document.getElementById("dialog-confirm");

  var running = false;
  var lastTrigger = null; // element to return focus to after dialog closes
  var pendingBuild = null; // { idea, button }

  // --- Helpers ------------------------------------------------------------
  // Escape for safe insertion into BOTH HTML text and double/single-quoted
  // attributes. The embedded data is same-origin and static, but values are
  // interpolated into attributes (data-title, id, aria-labelledby), so quotes
  // must be escaped to prevent attribute breakout regardless of data content.
  function esc(str) {
    return (str == null ? "" : String(str))
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function nowStamp() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, "0"); }
    return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, prefersReducedMotion ? 0 : ms);
    });
  }

  function scorePips(value, max) {
    var out = "";
    for (var i = 1; i <= max; i++) {
      out += '<span class="pip' + (i <= value ? " on" : "") + '" aria-hidden="true"></span>';
    }
    return out;
  }

  // --- Log lines ----------------------------------------------------------
  function addLogLine(text, opts) {
    opts = opts || {};
    var line = document.createElement("div");
    line.className = "log-line";
    if (opts.active) line.classList.add("is-active");
    var glyph = opts.glyph || "·";
    line.innerHTML =
      '<span class="stamp">' + nowStamp() + "</span>" +
      '<span class="glyph" aria-hidden="true">' + glyph + "</span>" +
      '<span class="text">' + text + "</span>";
    runLog.appendChild(line);
    return line;
  }

  function settleLine(line, glyph, html) {
    if (!line) return;
    line.classList.remove("is-active");
    line.classList.add("is-done");
    var g = line.querySelector(".glyph");
    if (g) g.textContent = glyph || "✓";
    if (html != null) {
      var t = line.querySelector(".text");
      if (t) t.innerHTML = html;
    }
  }

  // --- Idea card rendering ------------------------------------------------
  function buildIdeaCard(idea, index) {
    var card = document.createElement("article");
    card.className = "idea-card";
    card.setAttribute("aria-labelledby", "idea-h-" + esc(idea.id));

    var competitors = (idea.competitors || [])
      .map(function (c) { return "<li>" + esc(c) + "</li>"; })
      .join("");
    var sources = (idea.sources || [])
      .map(function (s) {
        return '<li><a href="' + esc(s) + '" target="_blank" rel="noopener noreferrer">' + esc(s) + "</a></li>";
      })
      .join("");
    var tags = (idea.tags || [])
      .map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; })
      .join("");

    var feas = idea.feasibility_score || 0;
    var nov = idea.novelty_score || 0;

    card.innerHTML =
      // 印章 verified seal badge. The red seal is decorative (aria-hidden),
      // but the badge as a whole is INFORMATIONAL ("generated · verified"),
      // so it pairs a visible text label so meaning is not color-only.
      '<span class="idea-seal">' +
        '<span class="seal seal-stamp" aria-hidden="true">' +
          '<svg viewBox="0 0 60 60" focusable="false"><use href="#seal-glyph-verify"/></svg>' +
        "</span>" +
        '<span class="seal-label">已生成・驗證 / generated</span>' +
      "</span>" +
      '<div class="idea-head">' +
        '<span class="idnum">' + esc(idea.id) + "</span>" +
        '<h3 id="idea-h-' + esc(idea.id) + '">' + esc(idea.title) + "</h3>" +
        '<span class="idea-domain">' + esc(idea.domain) + "</span>" +
      "</div>" +
      '<p class="idea-oneliner">' + esc(idea.one_liner) + "</p>" +
      '<div class="idea-scores">' +
        '<span class="score">可行性 / Feasibility ' +
          '<span class="dots">' + scorePips(feas, 5) + "</span>" +
          "<span>" + esc(feas) + "/5</span></span>" +
        '<span class="score">新穎度 / Novelty ' +
          '<span class="dots">' + scorePips(nov, 5) + "</span>" +
          "<span>" + esc(nov) + "/5</span></span>" +
      "</div>" +
      '<div class="idea-tags">' + tags + "</div>" +
      '<details class="more">' +
        "<summary>展開問題・解法・市場・來源 / Expand details</summary>" +
        "<h4>問題 / Problem</h4><p>" + esc(idea.problem) + "</p>" +
        "<h4>解法 / Solution</h4><p>" + esc(idea.solution) + "</p>" +
        "<h4>市場規模 / Market size</h4><p>" + esc(idea.market_size) + "</p>" +
        "<h4>競爭者 / Competitors</h4><ul>" + competitors + "</ul>" +
        '<h4>來源 / Sources</h4><ul class="sources">' + sources + "</ul>" +
      "</details>" +
      ownerActionsMarkup(idea);

    wireOwnerActions(card, idea);
    return card;
  }

  function ownerActionsMarkup(idea) {
    return (
      '<div class="owner-actions">' +
        '<span class="owner-label">站長操作 / Owner</span>' +
        '<button type="button" class="btn btn-primary btn-sm" data-action="build" data-title="' +
          esc(idea.title) + '">進行 MVP 製作 / Build MVP</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="dismiss">擱置 / Shelve</button>' +
      "</div>"
    );
  }

  function wireOwnerActions(card, idea) {
    var buildBtn = card.querySelector('[data-action="build"]');
    var dismissBtn = card.querySelector('[data-action="dismiss"]');
    if (buildBtn) {
      buildBtn.addEventListener("click", function () {
        openBuildDialog(idea, buildBtn);
      });
    }
    if (dismissBtn) {
      dismissBtn.addEventListener("click", function () {
        toast("已擱置「" + idea.title + "」（原型佔位）。 / Shelved " + idea.title + ".");
      });
    }
  }

  // --- The replay ---------------------------------------------------------
  var STRATEGY = DATA.strategy_used || "mixed";
  var CHAIN_LABEL = "claude(t10) → codex(t9)";

  function setStreamBusy(busy) {
    runLog.setAttribute("aria-busy", busy ? "true" : "false");
    ideasStream.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function setProgress(done, total) {
    var pct = total ? Math.round((done / total) * 100) : 0;
    progressFill.style.width = pct + "%";
    runCount.textContent = done + " / " + total;
  }

  async function runReplay() {
    if (running) return;
    running = true;
    watchBtn.disabled = true;
    watchBtn.textContent = "生成中… / Generating…";
    resetBtn.hidden = false;
    runStatus.hidden = false;
    setStreamBusy(true);
    runLog.innerHTML = "";
    ideasStream.innerHTML = "";

    var total = IDEAS.length;
    setProgress(0, total);
    runStatusText.textContent = "運行中 / running";

    // Boot lines: mirror engine startup output
    var l;
    l = addLogLine("<b>$ python engine/main.py --use-agents</b>", { glyph: "›" });
    await wait(420);
    settleLine(l, "›");

    l = addLogLine("偵測 PATH 上的 CLI agents… / detecting agents (min_tier=8)", { active: true, glyph: "◴" });
    await wait(700);
    settleLine(l, "✓", "Agents in chain: <b>" + CHAIN_LABEL + "</b> · gemini/ollama gated out");

    l = addLogLine("策略 / strategy = <b>" + esc(STRATEGY) + "</b> · 挑選 " + total + " 個領域 / selecting domains", { active: true, glyph: "◴" });
    await wait(650);
    var domainList = IDEAS.map(function (i) { return i.domain; }).join(", ");
    settleLine(l, "✓", "領域 / domains: " + esc(domainList));

    // Per-idea: search → render prompt → dispatch → parse → reveal
    for (var i = 0; i < total; i++) {
      var idea = IDEAS[i];
      var n = i + 1;
      var pre = "[" + n + "/" + total + "] <b>" + esc(idea.domain) + "</b>";

      var ls = addLogLine(pre + " · search.search → SearXNG :8888 …", { active: true, glyph: "◴" });
      await wait(prefersReducedMotion ? 0 : 360 + Math.random() * 260);
      var snippetN = 3 + Math.floor(Math.random() * 4);
      settleLine(ls, "✓", pre + " · SearXNG 回 " + snippetN + " 則 snippet / " + snippetN + " snippets");

      var lp = addLogLine(pre + " · skill_loader → render SKILL.md (Jinja)", { active: true, glyph: "◴" });
      await wait(prefersReducedMotion ? 0 : 220);
      settleLine(lp, "✓", pre + " · prompt rendered");

      var ld = addLogLine(pre + " · agents.dispatch → <b>claude -p</b> …", { active: true, glyph: "◴" });
      await wait(prefersReducedMotion ? 0 : 520 + Math.random() * 420);
      settleLine(ld, "✓", pre + " · parse JSON → Idea <b>" + esc(idea.title) + "</b>");

      // Materialize the real card
      revealIdea(idea, i);
      setProgress(n, total);
      await wait(prefersReducedMotion ? 0 : 260);
    }

    var done = addLogLine("<b>Done! " + total + " ideas researched.</b> → 寫入 data/" + esc(DATA.date) + "/ideas.json", { glyph: "✓" });
    done.classList.add("is-done");
    runStatusText.textContent = "完成 / done";
    setStreamBusy(false);
    running = false;
    watchBtn.disabled = false;
    watchBtn.textContent = "重新觀看 / Watch again";
  }

  function revealIdea(idea, index) {
    var card = buildIdeaCard(idea, index);
    if (!prefersReducedMotion) card.classList.add("condensing");
    ideasStream.appendChild(card);
  }

  function instantRenderAll() {
    // Reduced-motion / direct path: just show all results.
    runLog.innerHTML = "";
    ideasStream.innerHTML = "";
    runStatus.hidden = false;
    runStatusText.textContent = "完成 / done";
    var total = IDEAS.length;
    addLogLine("已直接顯示 " + total + " 個今日點子（略過動畫）。 / Showing " + total + " ideas (motion skipped).", { glyph: "✓" }).classList.add("is-done");
    for (var i = 0; i < total; i++) {
      var card = buildIdeaCard(IDEAS[i], i);
      ideasStream.appendChild(card);
    }
    setProgress(total, total);
    setStreamBusy(false);
    resetBtn.hidden = false;
    watchBtn.textContent = "重新顯示 / Show again";
  }

  function resetDemo() {
    runLog.innerHTML = "";
    ideasStream.innerHTML = "";
    runStatus.hidden = true;
    setProgress(0, IDEAS.length);
    setStreamBusy(false);
    resetBtn.hidden = true;
    running = false;
    watchBtn.disabled = false;
    watchBtn.textContent = "觀看今天的生成 / Watch today's run";
    watchBtn.focus();
  }

  watchBtn.addEventListener("click", function () {
    if (prefersReducedMotion) {
      instantRenderAll();
    } else {
      runReplay();
    }
  });
  resetBtn.addEventListener("click", resetDemo);

  // --- Build-MVP dialog ---------------------------------------------------
  function openBuildDialog(idea, trigger) {
    pendingBuild = { idea: idea, button: trigger };
    lastTrigger = trigger;
    dialogTarget.textContent = idea.title + "（" + idea.domain + "）";
    if (typeof confirmDialog.showModal === "function") {
      confirmDialog.showModal();
      // Do NOT autofocus the destructive/primary action — focus Cancel.
      var cancelBtn = document.getElementById("dialog-cancel");
      if (cancelBtn) cancelBtn.focus();
    } else {
      // Extremely old browser fallback: confirm via toast directly.
      queueBuild(idea);
    }
  }

  confirmDialog.addEventListener("close", function () {
    var val = confirmDialog.returnValue;
    if (val === "confirm" && pendingBuild) {
      queueBuild(pendingBuild.idea, pendingBuild.button);
    }
    pendingBuild = null;
    // Return focus to the trigger.
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
    lastTrigger = null;
  });

  function queueBuild(idea, button) {
    toast("已排入 MVP 製作佇列：「" + idea.title + "」 / Queued MVP build for " + idea.title + ".");
    if (button) {
      button.disabled = true;
      var actions = button.closest(".owner-actions");
      if (actions && !actions.querySelector(".built")) {
        var span = document.createElement("span");
        span.className = "built";
        span.innerHTML = '<span aria-hidden="true">✓</span> 已排入 / queued';
        actions.appendChild(span);
      }
    }
  }

  // --- Toast (role=status) ------------------------------------------------
  function toast(message) {
    var t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.innerHTML = '<span class="glyph" aria-hidden="true">✓</span><span>' + esc(message) + "</span>";
    toastRegion.appendChild(t);
    setTimeout(function () {
      t.style.transition = "opacity 400ms ease";
      t.style.opacity = "0";
      setTimeout(function () {
        if (t.parentNode) t.parentNode.removeChild(t);
      }, 450);
    }, 5200);
  }

  // --- Admin gate (client-side DEMO stub) ---------------------------------
  var ADMIN_PASSWORD = "asagiri-admin"; // prototype stub only — not real auth
  var gate = document.getElementById("gate");
  var lockForm = document.getElementById("lock-form");
  var passInput = document.getElementById("admin-pass");
  var gateMsg = document.getElementById("gate-msg");
  var lockBtn = document.getElementById("lock-btn");
  var runGenBtn = document.getElementById("run-gen-btn");

  lockForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (passInput.value === ADMIN_PASSWORD) {
      unlock();
    } else {
      gateMsg.textContent = "密碼不正確（提示：asagiri-admin）。 / Incorrect password.";
      gateMsg.className = "gate-msg err";
      passInput.focus();
      passInput.select();
    }
  });

  function unlock() {
    document.body.classList.add("is-admin");
    gate.classList.add("unlocked");
    gateMsg.textContent = "已解鎖 / unlocked.";
    gateMsg.className = "gate-msg ok";
    passInput.value = "";
    toast("站長控制台已解鎖（原型佔位）。 / Owner controls unlocked.");
    // Move focus into the now-visible panel for keyboard users.
    if (runGenBtn) runGenBtn.focus();
  }

  function lock() {
    document.body.classList.remove("is-admin");
    gate.classList.remove("unlocked");
    gateMsg.textContent = "";
    gateMsg.className = "gate-msg";
    passInput.focus();
  }

  if (lockBtn) lockBtn.addEventListener("click", lock);
  if (runGenBtn) {
    runGenBtn.addEventListener("click", function () {
      toast("已送出新的生成請求（原型佔位，引擎實際上一晚才跑完）。 / Queued a new generation run.");
    });
  }

  /* =======================================================================
   * 卷軸 SCROLL CHROME (A2) — all decorative, all reduced-motion-safe.
   *   1. Unroll-on-load: reveal the painting field from the top down.
   *   2. 絵巻 horizontal pipeline: keyboard + drag scroll, vertical fallback.
   * None of this gates content: if JS fails, CSS keeps the field visible
   * (the .scroll-field unrolled state is also the reduced-motion default).
   * ===================================================================== */

  // --- 1. Unroll the painting field on load ------------------------------
  var scrollMount = document.querySelector("[data-scroll]");
  var scrollField = scrollMount ? scrollMount.querySelector(".scroll-field") : null;
  if (scrollMount && scrollField) {
    if (prefersReducedMotion) {
      // Reduced-motion: show the fully-unrolled scroll instantly, no animation.
      scrollMount.classList.add("no-anim");
      scrollField.classList.add("is-unrolled");
    } else {
      // Animate the unroll on the next frame so the transition runs.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          scrollField.classList.add("is-unrolled");
        });
      });
      // Safety net: if for any reason the class wasn't applied, force-open
      // after a beat so content can never be permanently clipped.
      setTimeout(function () {
        if (!scrollField.classList.contains("is-unrolled")) {
          scrollField.classList.add("is-unrolled");
        }
      }, 1600);
    }
  }

  // --- 2. 絵巻 horizontal pipeline region --------------------------------
  var emakiViewport = document.getElementById("emaki-viewport");
  if (emakiViewport) {
    // 2a. Keyboard scroll: arrow keys, Home/End, PageUp/PageDown.
    emakiViewport.addEventListener("keydown", function (e) {
      var step = 80;
      var page = emakiViewport.clientWidth * 0.85;
      var max = emakiViewport.scrollWidth - emakiViewport.clientWidth;
      var handled = true;
      switch (e.key) {
        case "ArrowRight": emakiViewport.scrollLeft += step; break;
        case "ArrowLeft":  emakiViewport.scrollLeft -= step; break;
        case "PageDown":   emakiViewport.scrollLeft += page; break;
        case "PageUp":     emakiViewport.scrollLeft -= page; break;
        case "Home":       emakiViewport.scrollLeft = 0; break;
        case "End":        emakiViewport.scrollLeft = max; break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    });

    // 2b. Pointer drag-to-scroll (mouse / pen / touch via Pointer Events).
    var dragging = false, startX = 0, startScroll = 0, moved = false;
    emakiViewport.addEventListener("pointerdown", function (e) {
      // Don't hijack focusable children; the strip has none, but be safe.
      dragging = true;
      moved = false;
      startX = e.clientX;
      startScroll = emakiViewport.scrollLeft;
      emakiViewport.classList.add("is-dragging");
      try { emakiViewport.setPointerCapture(e.pointerId); } catch (err) {}
    });
    emakiViewport.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      emakiViewport.scrollLeft = startScroll - dx;
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      emakiViewport.classList.remove("is-dragging");
      try { emakiViewport.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    emakiViewport.addEventListener("pointerup", endDrag);
    emakiViewport.addEventListener("pointercancel", endDrag);

    // 2c. Vertical stacked fallback (<=640px) — a reflow-safe restatement of
    // the same six pipeline scenes, no forced horizontal scroll on mobile.
    var emakiFig = emakiViewport.closest(".emaki");
    if (emakiFig && !emakiFig.querySelector(".emaki-fallback")) {
      var scenes = [
        ["壱", "挑選領域 / Domain select", "config.yaml · strategy · 10 槽位"],
        ["弐", "agent 鏈 / Agent chain", "claude → codex → gemini → ollama"],
        ["参", "SearXNG", "search.py · 127.0.0.1:8888 · Brave fallback"],
        ["肆", "綜合 / Synthesis", "agent_research.py · SKILL.md → Jinja"],
        ["伍", "ideas.json", "artifact · data/<date>/ · 10 ideas"],
        ["陸", "webapp", "Next.js 16 · read-only · dashboard · kanban"]
      ];
      var listHtml = scenes.map(function (s) {
        return "<li>" +
          '<span class="ef-step">' + esc(s[0]) + "</span>" +
          '<span class="ef-title">' + esc(s[1]) + "</span>" +
          '<span class="ef-sub">' + esc(s[2]) + "</span>" +
        "</li>";
      }).join("");
      var fb = document.createElement("div");
      fb.className = "emaki-fallback";
      // Hidden from AT when the SVG region is shown; the SVG title/desc carry
      // the meaning on wide screens. Shown (and exposed) only on narrow.
      fb.innerHTML = "<ol>" + listHtml + "</ol>";
      emakiFig.appendChild(fb);
    }
  }
})();
