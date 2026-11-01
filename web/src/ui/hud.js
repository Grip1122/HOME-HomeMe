/* global window, document */
(function (global) {
  "use strict";
  const UI = (global.XiaomiHomeUI = global.XiaomiHomeUI || {});
  const C = UI.COPY;

  const ICON_MIC =
    '<svg viewBox="0 0 16 16" fill="none"><rect x="6" y="1.8" width="4" height="7" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M4.2 8.2a3.8 3.8 0 0 0 7.6 0M8 12v2.2M5.8 14.2h4.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  const ICON_SPEAK =
    '<svg viewBox="0 0 16 16" fill="none"><path d="M2.2 6.2h2.3L7.8 3.4v9.2L4.5 9.8H2.2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10 5.8a3 3 0 0 1 0 4.4M11.7 4.1a5.4 5.4 0 0 1 0 7.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  const ICON_SEND =
    '<svg viewBox="0 0 16 16" fill="none"><path d="M2.5 8h9M8.5 4.5L12 8l-3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_CHECK =
    '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8.4l3.2 3.2L13 4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const SUGGESTIONS = C.chat.suggestions
    .map((s) => `<button class="ht-sug" type="button" data-query="${s.query}">${s.label}</button>`)
    .join("");

  const TEMPLATE = `
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M6 22V12.5C6 8.9 8.9 6 12.5 6h7C23.1 6 26 8.9 26 12.5V22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="14.5" r="3.2" stroke="currentColor" stroke-width="1.8"/><path d="M10 25h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
      <div class="brand-text"><strong>小觅HOME</strong><span>空间记忆 · 具身找物系统</span></div>
    </div>
    <div class="top-status">
      <span class="pill"><i class="dot live"></i>端侧运行</span>
      <span class="pill ht-layout-pill"><i class="dot"></i>餐厅实景</span>
      <span class="pill ht-memory-pill"><i class="dot cyan"></i>${C.pills.memoryOn}</span>
      <span class="pill mono ht-plan-pill">3DGS · ROBOT</span>
    </div>
    <div class="top-actions">
      <button class="btn ghost" id="btn-health" type="button">服务状态</button>
      <button class="btn ghost ht-compare-open" type="button">${C.actions.compare}</button>
      <button class="btn ghost ht-director-open" type="button">${C.actions.director}</button>
      <button class="btn primary ht-reset" type="button">${C.actions.reset}</button>
      <button class="btn ghost" id="btn-experience" type="button">空间记忆体验</button>
    </div>
  </header>

  <aside class="side-panel left glass ht-left-panel">
    <div class="panel-title"><span>${C.memory.title}</span><span class="count ht-count">0</span></div>
    <p class="panel-sub">${C.memory.sub}</p>
    <div class="memory-list ht-memory-list" role="list"></div>
    <div class="memory-empty ht-mem-empty"><div class="empty-orbit"><span></span></div><strong>${C.memory.emptyTitle}</strong><span>${C.memory.emptySub}</span></div>
    <div class="privacy-card"><div class="privacy-head"><span class="privacy-shield">◈</span><div><strong>${C.memory.footLeft}</strong><small>本地记忆 · 断网可检索</small></div><span class="live-tag">LOCAL</span></div></div>
  </aside>

  <aside class="side-panel right glass">
    <section class="ht-status">
      <div class="robot-card">
        <div class="robot-avatar"><span class="avatar-ring"></span><span class="avatar-eye"></span><span class="avatar-eye"></span></div>
        <div class="robot-meta"><div class="robot-name">${C.brand.robotName}<span class="online">在线</span></div><div class="robot-state ht-state-text" aria-live="polite">${C.status.default}</div></div>
        <span class="ht-state-dot"></span>
      </div>
      <div class="ht-task-meta"><span class="ht-step-indicator">${C.status.waiting}</span><span class="ht-source-badge">${C.status.sourceDefault}</span></div>
      <div class="ht-progress"><i></i></div>
    </section>
    <div class="timeline-head"><span>${C.timeline.title}</span><span class="step-badge ht-task-pill">${C.timeline.pill.idle}</span></div>
    <div class="timeline ht-timeline" aria-live="polite"><div class="timeline-empty ht-tl-empty">${C.timeline.empty}</div></div>
    <div id="ops" class="demo-actions"><div class="demo-title">现场演示</div><button id="btn-cancel" type="button" disabled>取消当前任务</button><button id="btn-fail" type="button">演示：执行失败</button></div>
  </aside>

  <div class="bottom-dock ht-chat">
    <div class="ht-chat-messages" role="log" aria-live="polite"></div>
    <div class="suggestions"><span class="sug-label">${C.chat.suggestLabel}</span>${SUGGESTIONS}</div>
    <form class="query-bar ht-chat-bar" autocomplete="off">
      <span class="search-ico" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5.5" stroke="currentColor" stroke-width="1.5"/><path d="M13.2 13.2l3.3 3.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>
      <input class="ht-chat-input" type="text" placeholder="${C.chat.placeholder}" aria-label="${C.chat.ariaInput}" />
      <button class="ht-icon-btn ht-mic" type="button" aria-label="${C.chat.mic}">${ICON_MIC}</button>
      <button class="ht-icon-btn ht-speak" type="button" aria-label="${C.chat.speak}">${ICON_SPEAK}</button>
      <button class="find-btn ht-send-btn" type="submit" aria-label="${C.chat.send}">${C.chat.send} ${ICON_SEND}</button>
    </form>
    <div class="dock-footer"><span class="hint">真实餐厅 · 交付机器人模型</span><span class="hint">拖拽旋转 · 滚轮缩放 · 右键平移</span></div>
  </div>

  <div class="ht-found" role="status" aria-live="polite">
    <div class="ht-found-head">
      <span class="ht-found-ico">${ICON_CHECK}</span>
      <div class="ht-found-name"><span class="ht-found-title">${C.found.title}</span><small class="ht-found-sub">${C.memory.unknownRoom}</small></div>
      <button class="ht-found-close" type="button" aria-label="${C.found.dismiss}">×</button>
    </div>
    <div class="ht-found-body"><div class="ht-conf"><i class="ht-found-bar"></i></div><span class="ht-found-pct">—</span></div>
    <div class="ht-found-actions">
      <button type="button" data-found-action="dismiss">${C.found.dismiss}</button>
    </div>
  </div>

  <div class="ht-compare" role="dialog" aria-modal="true" aria-label="${C.actions.compare}">
    <div class="ht-compare-card">
      <button class="ht-compare-close" type="button" aria-label="${C.compare.close}">×</button>
      <div class="ht-compare-kicker">${C.compare.kicker}</div>
      <div class="ht-compare-title">${C.compare.title}</div>
      <div class="ht-compare-sub">${C.compare.sub}</div>
      <div class="ht-compare-empty" hidden><strong>${C.compare.emptyTitle}</strong><span>${C.compare.emptySub}</span></div>
      <div class="ht-compare-grid">
        <div class="ht-compare-col on"><h4>${C.compare.on}</h4><div class="big">${C.compare.noValue}</div><div class="row"><span>${C.compare.time}</span><span class="v-time">${C.compare.noValue}</span></div></div>
        <div class="ht-compare-col off"><h4>${C.compare.off}</h4><div class="big">${C.compare.noValue}</div><div class="row"><span>${C.compare.time}</span><span class="v-time">${C.compare.noValue}</span></div></div>
      </div>
      <div class="ht-compare-bars"></div>
      <div class="ht-compare-note"></div>
    </div>
  </div>

  <div class="ht-director-backdrop"></div>
  <div class="ht-director" role="dialog" aria-modal="true" aria-label="${C.director.title}">
    <div class="ht-director-head">
      <div><div class="ht-director-kicker">${C.director.kicker}</div><div class="ht-director-title">${C.director.title}</div><div class="ht-director-sub">${C.director.sub}</div></div>
      <button class="ht-director-close" type="button" aria-label="${C.compare.close}">×</button>
    </div>
    <div class="ht-director-group">
      <h4>${C.director.journeys}</h4>
      <div class="ht-director-grid">
        <button type="button" data-action="query:first"><b>${C.director.buttons.first.title}</b><small>${C.director.buttons.first.sub}</small></button>
        <button type="button" data-action="query:memory"><b>${C.director.buttons.memory.title}</b><small>${C.director.buttons.memory.sub}</small></button>
        <button type="button" data-action="teleport:moved"><b>${C.director.buttons.moved.title}</b><small>${C.director.buttons.moved.sub}</small></button>
        <button type="button" data-action="query:correct"><b>${C.director.buttons.correct.title}</b><small>${C.director.buttons.correct.sub}</small></button>
        <button type="button" class="wide" data-action="compare"><b>${C.director.buttons.compare.title}</b><small>${C.director.buttons.compare.sub}</small></button>
      </div>
    </div>
    <div class="ht-director-group">
      <h4>${C.director.controls}</h4>
      <div class="ht-director-grid">
        <button type="button" data-action="reset"><b>${C.director.buttons.reset.title}</b><small>${C.director.buttons.reset.sub}</small></button>
      </div>
    </div>
    <div class="ht-director-group">
      <h4>${C.director.switches}</h4>
      <label class="ht-switch"><input class="ht-director-memory" type="checkbox" checked /><span class="ht-switch-track"><i></i></span><span><b>${C.director.memory}</b><small>${C.director.memorySub}</small></span></label>
    </div>
    <div class="ht-director-foot">${C.director.foot}</div>
  </div>

  <div class="ht-toast" role="status" aria-live="polite"></div>
  `;

  function qs(root, sel) {
    return root.querySelector(sel);
  }

  class Hud {
    constructor(opts) {
      opts = opts || {};
      if (!opts.bus) throw new Error("createHud requires { bus }");
      if (!C) throw new Error("XiaomiHomeUI.copy 未加载");
      this.bus = opts.bus;
      this.options = opts;
      this.subs = [];
      this.timers = {};
      this.catalog = opts.catalog || {};
      this.memoryEnabled = opts.memoryEnabled !== false;
      this.layoutId = opts.layoutId || "A";
      this.root = typeof opts.root === "string" ? document.querySelector(opts.root) : opts.root || document.body;
      this.el = document.createElement("div");
      this.el.className = "ht-ui";
      this.el.innerHTML = TEMPLATE;
      this.root.appendChild(this.el);

      this._checkDeps();
      this._components();
      this._bindHud();
      this._subscribe();
      this._syncDefault();
    }

    _checkDeps() {
      const need = ["Chat", "Status", "MemoryPanel", "Timeline", "Compare", "Voice", "Director"];
      const missing = need.filter((k) => !UI[k]);
      if (missing.length) throw new Error("XiaomiHomeUI 缺少组件: " + missing.join(", "));
    }

    _components() {
      const objectNames = {};
      Object.keys(this.catalog).forEach((id) => {
        const meta = this.catalog[id] || {};
        objectNames[id] = meta.name || id;
      });
      this.chat = new UI.Chat(this.bus, qs(this.el, ".ht-chat"), {
        getMemoryEnabled: () => this.memoryEnabled,
        onToast: (text, type) => this.toast(text, type),
      });
      this.status = new UI.Status(this.bus, qs(this.el, ".ht-status"));
      this.memory = new UI.MemoryPanel(this.bus, qs(this.el, ".ht-left-panel"), { catalog: this.catalog });
      this.timeline = new UI.Timeline(this.bus, qs(this.el, ".ht-timeline"), { objectNames });
      this.compare = new UI.Compare(this.bus, qs(this.el, ".ht-compare"));
      this.voice = new UI.Voice(this.bus, qs(this.el, ".ht-chat"), {
        getMemoryEnabled: () => this.memoryEnabled,
        onToast: (text, type) => this.toast(text, type),
      });
      this.director = new UI.Director(this.bus, this.el, {
        getMemoryEnabled: () => this.memoryEnabled,
        setMemoryEnabled: (v) => this.setMemoryEnabled(v),
        getLayoutId: () => this.layoutId,
        onCompare: () => this.compare.open(),
        onToast: (text, type) => this.toast(text, type),
      });
    }

    _bindHud() {
      qs(this.el, ".ht-reset").addEventListener("click", () => {
        this.bus.emit("demo:reset", { layoutId: this.layoutId });
      });
      qs(this.el, ".ht-compare-open").addEventListener("click", () => this.compare.open());
      qs(this.el, ".ht-found-close").addEventListener("click", () => this.hideFound());
      this.el.querySelectorAll("[data-found-action]").forEach((btn) => {
        btn.addEventListener("click", () => this.hideFound());
      });
    }

    _subscribe() {
      const on = (name, fn) => {
        this.bus.on(name, fn);
        this.subs.push([name, fn]);
      };
      on("plan:received", (p) => this.setPlan(p && p.source, p && p.latencyMs));
      on("plan:rejected", (p) => {
        this.toast(p && p.reason ? C.status.planRejected + "：" + p.reason : C.status.planRejected, "error");
      });
      on("robot:blocked", (p) => {
        this.toast(p && p.reason ? p.reason : C.status.blocked, "warn");
      });
      on("task:start", () => {
        this.hideFound();
        qs(this.el, ".ht-task-pill").textContent = C.timeline.pill.running;
      });
      on("task:end", (p) => {
        if (!p || typeof p.ok !== "boolean") qs(this.el, ".ht-task-pill").textContent = C.timeline.pill.interrupted;
        else qs(this.el, ".ht-task-pill").textContent = p.ok ? C.timeline.pill.done : C.timeline.pill.failed;
        if (!p || p.ok === false) this.hideFound();
      });
      on("memory:hit", (p) => this.showFound(p || {}));
      on("memory:miss", () => this.hideFound());
      on("demo:reset", () => this.resetTask());
    }

    _syncDefault() {
      this.setLayout(this.layoutId);
      this.setMemoryEnabled(this.memoryEnabled);
      this.setPlan("rule", null);
      this.chat.addMessage("robot", this.options.welcomeText || C.chat.welcome);
    }

    setLayout(id) {
      this.layoutId = id || "A";
      const el = qs(this.el, ".ht-layout-pill");
      if (!el) return;
      el.innerHTML = '<i class="dot"></i>';
      el.appendChild(document.createTextNode(C.pills.layout + " " + this.layoutId));
    }

    setMemoryEnabled(enabled) {
      this.memoryEnabled = enabled !== false;
      const el = qs(this.el, ".ht-memory-pill");
      if (!el) return;
      el.className = "ht-pill " + (this.memoryEnabled ? "is-brand" : "is-off");
      el.innerHTML = '<i class="dot"></i>';
      el.appendChild(document.createTextNode(this.memoryEnabled ? C.pills.memoryOn : C.pills.memoryOff));
      this.director.setMemory(this.memoryEnabled);
    }

    setPlan(source, latency) {
      const el = qs(this.el, ".ht-plan-pill");
      if (!el) return;
      const label = C.status.sources[source] || source || C.status.sourceDefault;
      el.textContent = C.pills.plan + " · " + label + (Number.isFinite(latency) ? " " + Math.round(latency) + "ms" : "");
    }

    showFound(p) {
      const id = p.objectId;
      if (!id) return;
      const meta = this.catalog[id] || {};
      const rec = this.memory.get(id);
      const conf = typeof p.confidence === "number" && isFinite(p.confidence) ? p.confidence : rec ? rec.confidence : 0;
      const room = rec ? rec.room : C.memory.unknownRoom;
      qs(this.el, ".ht-found-title").textContent = C.found.title + " · " + (meta.name || C.found.unknownName);
      qs(this.el, ".ht-found-sub").textContent = room + " · " + C.found.confidence + " " + Math.round(conf * 100) + "%";
      qs(this.el, ".ht-found-bar").style.width = Math.round(conf * 100) + "%";
      qs(this.el, ".ht-found-pct").textContent = Math.round(conf * 100) + "%";
      this.foundObjectId = id;
      qs(this.el, ".ht-found").classList.add("is-open");
      clearTimeout(this.timers.found);
      this.timers.found = setTimeout(() => this.hideFound(), 9000);
    }

    hideFound() {
      qs(this.el, ".ht-found").classList.remove("is-open");
    }

    toast(text, type) {
      if (!text) return;
      const el = qs(this.el, ".ht-toast");
      el.textContent = text;
      el.className = "ht-toast is-open" + (type ? " is-" + type : "");
      clearTimeout(this.timers.toast);
      this.timers.toast = setTimeout(() => el.classList.remove("is-open"), 3200);
    }

    resetTask() {
      this.status.reset();
      this.timeline.reset();
      qs(this.el, ".ht-task-pill").textContent = C.timeline.pill.idle;
      this.hideFound();
    }

    resetMemory() {
      this.memory.reset();
    }

    destroy() {
      clearTimeout(this.timers.toast);
      clearTimeout(this.timers.found);
      [this.chat, this.status, this.memory, this.timeline, this.compare, this.voice, this.director].forEach((c) => {
        if (c && c.destroy) c.destroy();
      });
      if (this.bus.off) this.subs.forEach(([name, fn]) => this.bus.off(name, fn));
      this.el.remove();
    }
  }

  UI.createHud = function (opts) {
    return new Hud(opts);
  };
  UI.version = "1.1.0";
})(window);
