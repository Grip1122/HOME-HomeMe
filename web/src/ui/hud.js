/* global window, document */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});

  const ICON_MIC =
    '<svg viewBox="0 0 16 16" fill="none"><rect x="6" y="1.8" width="4" height="7" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M4.2 8.2a3.8 3.8 0 0 0 7.6 0M8 12v2.2M5.8 14.2h4.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  const ICON_SPEAK =
    '<svg viewBox="0 0 16 16" fill="none"><path d="M2.2 6.2h2.3L7.8 3.4v9.2L4.5 9.8H2.2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10 5.8a3 3 0 0 1 0 4.4M11.7 4.1a5.4 5.4 0 0 1 0 7.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  const ICON_SEND =
    '<svg viewBox="0 0 16 16" fill="none"><path d="M2.5 8h9M8.5 4.5L12 8l-3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_CHECK =
    '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8.4l3.2 3.2L13 4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const TEMPLATE = `
  <div class="ht-topbar">
    <div class="ht-brand">
      <div class="ht-brand-mark">方</div>
      <div class="ht-brand-text"><strong>小方 HomeTwin</strong><span>虚拟孪生家庭 · 具身找物管家</span></div>
    </div>
    <div class="ht-pills">
      <span class="ht-pill is-live ht-online-pill"><i class="dot"></i>本机在线</span>
      <span class="ht-pill ht-layout-pill"><i class="dot"></i>布局 A</span>
      <span class="ht-pill is-brand ht-memory-pill"><i class="dot"></i>记忆增强 开</span>
      <span class="ht-pill mono ht-plan-pill">规划 · 规则</span>
    </div>
    <div class="ht-actions">
      <button class="ht-btn ghost ht-director-open" type="button" aria-label="打开导演模式">
        <svg viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M3 8h10M3 11.5h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        导演模式 <span class="ht-kbd">D</span>
      </button>
      <button class="ht-btn brand ht-reset" type="button" aria-label="重置场景">
        <svg viewBox="0 0 16 16" fill="none"><path d="M3.2 7.5A4.9 4.9 0 1 1 4.6 11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M3 3.5v4h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        重置
      </button>
    </div>
  </div>

  <aside class="ht-side left">
    <section class="ht-panel ht-card grow ht-left-panel">
      <div class="ht-panel-head"><span>空间记忆</span><span class="ht-count">0</span></div>
      <p class="ht-panel-sub">扫描后自动写入 · 低置信度会触发复扫</p>
      <div class="ht-memory-list" role="list"></div>
      <div class="ht-mem-empty"><strong>还没有空间记忆</strong><span>让小方扫描全屋后开始</span></div>
      <div class="ht-memory-foot"><span>本机 SQLite</span><strong>0 KB 上云</strong></div>
    </section>
  </aside>

  <aside class="ht-side right">
    <section class="ht-panel ht-card ht-status">
      <div class="ht-robot-card">
        <div class="ht-avatar"><span class="ring"></span><span class="eye"></span><span class="eye"></span></div>
        <div class="ht-robot-meta">
          <div class="ht-robot-name">小方 <span class="ht-live-tag">在线</span></div>
          <div class="ht-state-text" aria-live="polite">待机 · 我在呢</div>
        </div>
        <span class="ht-state-dot"></span>
      </div>
      <div class="ht-task-meta"><span class="ht-step-indicator">等待指令</span><span class="ht-source-badge">规则解析</span></div>
      <div class="ht-progress"><i></i></div>
    </section>

    <section class="ht-panel ht-card grow ht-timeline-panel">
      <div class="ht-timeline-head"><span>任务时间线</span><span class="ht-task-pill">待机</span></div>
      <div class="ht-timeline-wrap"><div class="ht-timeline" aria-live="polite"><div class="ht-tl-empty">执行任务后显示步骤</div></div></div>
    </section>
  </aside>

  <div class="ht-bottom">
    <div class="ht-card ht-chat">
      <div class="ht-chat-messages" role="log" aria-live="polite"></div>
      <div class="ht-suggestions">
        <span class="ht-sug-label">试着说</span>
        <button class="ht-sug" type="button" data-query="帮我找红色水杯">找红色水杯</button>
        <button class="ht-sug" type="button" data-query="钥匙在哪">找钥匙</button>
        <button class="ht-sug" type="button" data-query="帮我把遥控器放到茶几上">放到茶几</button>
        <button class="ht-sug" type="button" data-query="不对，水杯应该在书房">纠正位置</button>
      </div>
      <form class="ht-chat-bar" autocomplete="off">
        <input class="ht-chat-input" type="text" placeholder="告诉小方要找什么，例如：红色水杯在哪？" aria-label="输入找物指令" />
        <button class="ht-icon-btn ht-mic" type="button" aria-label="语音输入">${ICON_MIC}</button>
        <button class="ht-icon-btn ht-speak" type="button" aria-label="语音播报">${ICON_SPEAK}</button>
        <button class="ht-send-btn" type="submit" aria-label="发送">发送 ${ICON_SEND}</button>
      </form>
    </div>
  </div>

  <div class="ht-found" role="status" aria-live="polite">
    <div class="ht-found-head">
      <span class="ht-found-ico">${ICON_CHECK}</span>
      <div class="ht-found-name"><span class="ht-found-title">找到啦</span><small class="ht-found-sub">客厅 · 茶几</small></div>
      <button class="ht-found-close" type="button" aria-label="关闭">×</button>
    </div>
    <div class="ht-found-body"><div class="ht-conf"><i class="ht-found-bar"></i></div><span class="ht-found-pct">90%</span></div>
    <div class="ht-found-actions">
      <button type="button" class="primary" data-found-action="bring">带回来</button>
      <button type="button" data-found-action="dismiss">知道了</button>
    </div>
  </div>

  <div class="ht-compare" role="dialog" aria-modal="true" aria-label="训练前后对比">
    <div class="ht-compare-card">
      <button class="ht-compare-close" type="button" aria-label="关闭">×</button>
      <div class="ht-compare-kicker">MEMORY ON / OFF · REAL LOGS</div>
      <div class="ht-compare-title">记忆开启前后，差多少？</div>
      <div class="ht-compare-sub">同一布局、同一指令、同一初始位置，只切换记忆开关。数据来自任务日志。</div>
      <div class="ht-compare-grid">
        <div class="ht-compare-col on"><h4>记忆开启</h4><div class="big">3<small>步</small></div><div class="row"><span>耗时</span><span class="v-time">5.6s</span></div><div class="row"><span>行走</span><span class="v-dist">4.2m</span></div></div>
        <div class="ht-compare-col off"><h4>记忆关闭</h4><div class="big">8<small>步</small></div><div class="row"><span>耗时</span><span class="v-time">18.4s</span></div><div class="row"><span>行走</span><span class="v-dist">11.8m</span></div></div>
      </div>
      <div class="ht-compare-bars"></div>
      <div class="ht-compare-note"></div>
    </div>
  </div>

  <div class="ht-director-backdrop"></div>
  <div class="ht-director" role="dialog" aria-modal="true" aria-label="导演模式">
    <div class="ht-director-head">
      <div><div class="ht-director-kicker">DIRECTOR MODE</div><div class="ht-director-title">导演模式</div><div class="ht-director-sub">零打字彩排 · 一键触发五条用户旅程</div></div>
      <button class="ht-director-close" type="button" aria-label="关闭">×</button>
    </div>
    <div class="ht-director-group">
      <h4>用户旅程</h4>
      <div class="ht-director-grid">
        <button type="button" data-action="script:first"><b>首次找物</b><small>记忆关闭 · 全屋扫描</small></button>
        <button type="button" data-action="script:memory"><b>记忆直达</b><small>水杯 → 客厅茶几</small></button>
        <button type="button" data-action="script:moved"><b>物品被移动</b><small>旧位置落空 → 复扫</small></button>
        <button type="button" data-action="script:correct"><b>用户纠正</b><small>“不对，在书房”</small></button>
        <button type="button" data-action="script:compare"><b>训练前后对比</b><small>记忆开 / 关真实日志</small></button>
        <button type="button" data-action="script:layoutB"><b>切换布局 B</b><small>同一 Agent 换环境</small></button>
        <button type="button" class="wide" data-action="script:offline"><b>断网演示</b><small>规则 / 缓存 / 离线脚本三级兜底</small></button>
      </div>
    </div>
    <div class="ht-director-group">
      <h4>现场控制</h4>
      <div class="ht-director-grid">
        <button type="button" data-action="scene:reset"><b>重置场景</b><small>机器人与物体回位</small></button>
        <button type="button" class="danger" data-action="clear"><b>清空记忆</b><small>重新建立空间记忆</small></button>
      </div>
    </div>
    <div class="ht-director-group">
      <h4>开关</h4>
      <label class="ht-switch"><input class="ht-director-memory" type="checkbox" checked /><span class="ht-switch-track"><i></i></span><span><b>记忆增强</b><small>关闭后 find 必走全屋扫描</small></span></label>
    </div>
    <div class="ht-director-foot">快捷键 <span class="ht-kbd">D</span> 呼出 / <span class="ht-kbd">Esc</span> 关闭。路演时优先用这里，不要临场打字。</div>
  </div>

  <div class="ht-toast" role="status" aria-live="polite"></div>
  <div class="ht-offline-badge"><i></i>OFFLINE · 本机记忆</div>
  <div class="ht-scene-tag"><b>SCENE MOCK</b><br />设计 A 的 three.js 场景替换此层</div>
  `;

  function qs(root, sel) {
    return root.querySelector(sel);
  }

  class Hud {
    constructor(opts) {
      opts = opts || {};
      if (!opts.bus) throw new Error("createHud requires { bus }");
      this.bus = opts.bus;
      this.options = opts;
      this.subs = [];
      this.timers = {};
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
      if (missing.length) throw new Error("HomeTwinUI 缺少组件: " + missing.join(", ") + "。请按 script 顺序加载。");
    }

    _components() {
      this.chat = new UI.Chat(this.bus, qs(this.el, ".ht-chat"), this.options);
      this.status = new UI.Status(this.bus, qs(this.el, ".ht-status"));
      this.memory = new UI.MemoryPanel(this.bus, qs(this.el, ".ht-left-panel"));
      this.timeline = new UI.Timeline(this.bus, qs(this.el, ".ht-timeline"));
      this.compare = new UI.Compare(this.bus, qs(this.el, ".ht-compare"));
      this.voice = new UI.Voice(this.bus, qs(this.el, ".ht-chat"), this.options);
      this.director = new UI.Director(this.bus, this.el);
    }

    _bindHud() {
      qs(this.el, ".ht-reset").addEventListener("click", () => {
        this.bus.emit("ui:director", { action: "reset" });
      });
      const foundClose = qs(this.el, ".ht-found-close");
      foundClose.addEventListener("click", () => this.hideFound());
      this.el.querySelectorAll("[data-found-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.bus.emit("ui:foundAction", {
            action: btn.dataset.foundAction,
            objectId: this.foundObjectId,
          });
          this.hideFound();
        });
      });
    }

    _subscribe() {
      const on = (name, fn) => {
        this.bus.on(name, fn);
        this.subs.push([name, fn]);
      };
      on("toast", (p) => this.toast(p && p.text, p && p.type));
      on("found", (p) => this.showFound(p || {}));
      on("layout:change", (p) => this.setLayout(p && (p.name || p.id)));
      on("offline:change", (p) => this.setOffline(p && p.enabled));
      on("memory:toggle", (p) => this.setMemoryEnabled(p && p.enabled));
      on("plan:received", (p) => this.setPlan(p && p.source, p && p.latencyMs));
      on("plan:degraded", () => this.setPlan("rule", null));
      on("task:start", () => {
        this.hideFound();
        qs(this.el, ".ht-task-pill").textContent = "任务中";
      });
      on("task:end", (p) => {
        qs(this.el, ".ht-task-pill").textContent = p && p.found ? "已找到" : "完成";
      });
      on("task:reset", () => {
        qs(this.el, ".ht-task-pill").textContent = "待机";
        this.hideFound();
      });
      on("ui:director", (p) => {
        if (p && p.action === "memory:toggle") this.director.setMemory(!!p.enabled);
      });
      on("comparison:hide", () => this.compare.close());
    }

    _syncDefault() {
      this.setLayout(this.options.layoutName || "布局 A");
      this.setMemoryEnabled(this.options.memoryEnabled !== false);
      this.setOffline(false);
      this.setPlan("rule", null);
      if (this.options.welcome !== false) {
        this.bus.emit("chat:message", {
          role: "butler",
          text: this.options.welcomeText || "我在呢。要找什么？直接说颜色或物品名就好。",
        });
      }
    }

    setLayout(name) {
      if (!name) return;
      const el = qs(this.el, ".ht-layout-pill");
      el.innerHTML = '<i class="dot"></i>';
      el.appendChild(document.createTextNode(String(name)));
    }

    setMemoryEnabled(enabled) {
      const on = enabled !== false;
      const el = qs(this.el, ".ht-memory-pill");
      el.className = "ht-pill " + (on ? "is-brand" : "is-off");
      el.innerHTML = '<i class="dot"></i>记忆增强 ' + (on ? "开" : "关");
      this.director.setMemory(on);
    }

    setOffline(enabled) {
      const badge = qs(this.el, ".ht-offline-badge");
      badge.classList.toggle("is-open", !!enabled);
      const online = qs(this.el, ".ht-online-pill");
      if (enabled) {
        online.className = "ht-pill is-off";
        online.innerHTML = '<i class="dot"></i>离线运行';
        this.setPlan("offline", null);
      } else {
        online.className = "ht-pill is-live";
        online.innerHTML = '<i class="dot"></i>本机在线';
      }
    }

    setPlan(source, latency) {
      const map = { cache: "缓存命中", llm: "在线规划", online: "在线规划", rule: "规则解析", offline: "离线脚本", seed: "预置脚本" };
      const el = qs(this.el, ".ht-plan-pill");
      const label = map[source] || "规则解析";
      el.textContent = "规划 · " + label + (latency ? " " + Math.round(latency) + "ms" : "");
    }

    showFound(p) {
      const name = p.name || "目标物品";
      const room = p.room || "客厅";
      const furniture = p.furniture ? " · " + p.furniture : "";
      const conf = p.confidence === undefined ? 0.9 : Number(p.confidence);
      this.foundObjectId = p.objectId || p.object_id || null;
      qs(this.el, ".ht-found-title").textContent = "找到啦 · " + name;
      qs(this.el, ".ht-found-sub").textContent = room + furniture + " · 置信度 " + Math.round(conf * 100) + "%";
      qs(this.el, ".ht-found-bar").style.width = Math.round(conf * 100) + "%";
      qs(this.el, ".ht-found-pct").textContent = Math.round(conf * 100) + "%";
      const el = qs(this.el, ".ht-found");
      el.classList.add("is-open");
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
      this.timers.toast = setTimeout(() => {
        el.classList.remove("is-open");
      }, 3200);
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
  UI.version = "1.0.0";
})(window);
