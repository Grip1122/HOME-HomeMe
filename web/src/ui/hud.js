/* global window, document */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});
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
  <div class="ht-topbar">
    <div class="ht-brand">
      <div class="ht-brand-mark">${C.brand.mark}</div>
      <div class="ht-brand-text"><strong>${C.brand.title}</strong><span>${C.brand.subtitle}</span></div>
    </div>
    <div class="ht-pills">
      <span class="ht-pill is-live ht-online-pill"><i class="dot"></i>${C.pills.online}</span>
      <span class="ht-pill ht-layout-pill"><i class="dot"></i>${C.pills.layout} A</span>
      <span class="ht-pill is-brand ht-memory-pill"><i class="dot"></i>${C.pills.memoryOn}</span>
      <span class="ht-pill mono ht-plan-pill">${C.pills.plan} · ${C.status.sourceDefault}</span>
    </div>
    <div class="ht-actions">
      <button class="ht-btn ghost ht-compare-open" type="button">${C.actions.compare}</button>
      <button class="ht-btn ghost ht-director-open" type="button" aria-label="${C.actions.director}">
        <svg viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M3 8h10M3 11.5h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        ${C.actions.director} <span class="ht-kbd">D</span>
      </button>
      <button class="ht-btn brand ht-reset" type="button" aria-label="${C.actions.reset}">
        <svg viewBox="0 0 16 16" fill="none"><path d="M3.2 7.5A4.9 4.9 0 1 1 4.6 11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M3 3.5v4h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${C.actions.reset}
      </button>
    </div>
  </div>

  <aside class="ht-side left">
    <section class="ht-panel ht-card grow ht-left-panel">
      <div class="ht-panel-head"><span>${C.memory.title}</span><span class="ht-count">0</span></div>
      <p class="ht-panel-sub">${C.memory.sub}</p>
      <div class="ht-memory-list" role="list"></div>
      <div class="ht-mem-empty"><strong>${C.memory.emptyTitle}</strong><span>${C.memory.emptySub}</span></div>
      <div class="ht-memory-foot"><span>${C.memory.footLeft}</span><strong>${C.memory.footRight}</strong></div>
    </section>
  </aside>

  <aside class="ht-side right">
    <section class="ht-panel ht-card ht-status">
      <div class="ht-robot-card">
        <div class="ht-avatar"><span class="ring"></span><span class="eye"></span><span class="eye"></span></div>
        <div class="ht-robot-meta">
          <div class="ht-robot-name">${C.brand.robotName} <span class="ht-live-tag">${C.pills.online}</span></div>
          <div class="ht-state-text" aria-live="polite">${C.status.default}</div>
        </div>
        <span class="ht-state-dot"></span>
      </div>
      <div class="ht-task-meta"><span class="ht-step-indicator">${C.status.waiting}</span><span class="ht-source-badge">${C.status.sourceDefault}</span></div>
      <div class="ht-progress"><i></i></div>
    </section>

    <section class="ht-panel ht-card grow ht-timeline-panel">
      <div class="ht-timeline-head"><span>${C.timeline.title}</span><span class="ht-task-pill">${C.timeline.pill.idle}</span></div>
      <div class="ht-timeline-wrap"><div class="ht-timeline" aria-live="polite"><div class="ht-tl-empty">${C.timeline.empty}</div></div></div>
    </section>
  </aside>

  <div class="ht-bottom">
    <div class="ht-card ht-chat">
      <div class="ht-chat-messages" role="log" aria-live="polite"></div>
      <div class="ht-suggestions">
        <span class="ht-sug-label">${C.chat.suggestLabel}</span>
        ${SUGGESTIONS}
      </div>
      <form class="ht-chat-bar" autocomplete="off">
        <input class="ht-chat-input" type="text" placeholder="${C.chat.placeholder}" aria-label="${C.chat.ariaInput}" />
        <button class="ht-icon-btn ht-mic" type="button" aria-label="${C.chat.mic}" title="${C.chat.mic}">${ICON_MIC}</button>
        <button class="ht-icon-btn ht-speak" type="button" aria-label="${C.chat.speak}" title="${C.chat.speak}">${ICON_SPEAK}</button>
        <button class="ht-send-btn" type="submit" aria-label="${C.chat.send}">${C.chat.send} ${ICON_SEND}</button>
      </form>
    </div>
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
      if (!C) throw new Error("HomeTwinUI.copy 未加载");
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
      if (missing.length) throw new Error("HomeTwinUI 缺少组件: " + missing.join(", "));
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
