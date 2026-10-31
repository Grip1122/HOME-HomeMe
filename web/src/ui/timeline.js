/* global window */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});

  const ACTION_LABEL = {
    parse: "解析指令",
    memory: "检索记忆",
    find: "查找目标",
    go: "前往目标",
    grab: "抓取物品",
    drop: "放置物品",
    observe: "环顾观察",
    scan: "分区扫描",
    verify: "视觉复核",
    correct: "记忆纠正",
    plan: "生成计划",
  };

  function fmtDuration(ms) {
    if (ms === undefined || ms === null || isNaN(ms)) return "进行中";
    if (ms < 1000) return Math.round(ms) + "ms";
    return (ms / 1000).toFixed(1) + "s";
  }

  class Timeline {
    constructor(bus, root) {
      this.bus = bus;
      this.root = root;
      this.listEl = root;
      this.steps = new Map();
      this._subscribe();
    }

    _subscribe() {
      this._onStart = (p) => this.start(p || {});
      this._onStep = (p) => this.update(p || {});
      this._onEnd = (p) => this.end(p || {});
      this._onReset = () => this.reset();
      this.bus.on("task:start", this._onStart);
      this.bus.on("task:step", this._onStep);
      this.bus.on("task:end", this._onEnd);
      this.bus.on("task:reset", this._onReset);
    }

    reset() {
      this.listEl.innerHTML = '<div class="ht-tl-empty">执行任务后显示步骤</div>';
      this.steps.clear();
    }

    start() {
      this.listEl.innerHTML = "";
      this.steps.clear();
      const empty = document.createElement("div");
      empty.className = "ht-tl-empty";
      empty.textContent = "正在准备…";
      this.listEl.appendChild(empty);
    }

    update(p) {
      if (p.index === undefined) return;
      const empty = this.listEl.querySelector(".ht-tl-empty");
      if (empty) empty.remove();
      const key = p.index;
      let item = this.steps.get(key);
      if (!item) {
        const el = document.createElement("div");
        el.className = "ht-tl-item";
        el.innerHTML =
          '<div class="ht-tl-rail"><span class="ht-tl-dot"></span></div>' +
          '<div class="ht-tl-body"><div class="ht-tl-title"></div><div class="ht-tl-sub"></div><div class="ht-tl-time"></div></div>';
        this.listEl.appendChild(el);
        item = {
          el,
          titleEl: el.querySelector(".ht-tl-title"),
          subEl: el.querySelector(".ht-tl-sub"),
          timeEl: el.querySelector(".ht-tl-time"),
        };
        this.steps.set(key, item);
      }
      const action = p.action || "step";
      const label = p.label || ACTION_LABEL[action] || action;
      const target = p.targetLabel || p.targetName || p.target || "";
      item.titleEl.textContent = label + (target ? " · " + target : "");
      item.subEl.textContent = p.sub || (p.status === "active" ? "执行中" : "");
      if (p.status === "active") {
        item.el.classList.add("is-active");
        item.el.classList.remove("is-done", "is-error");
        item.timeEl.textContent = "进行中";
      } else if (p.status === "error") {
        item.el.classList.remove("is-active", "is-done");
        item.el.classList.add("is-error");
        item.timeEl.textContent = fmtDuration(p.durationMs);
      } else {
        item.el.classList.remove("is-active", "is-error");
        item.el.classList.add("is-done");
        item.timeEl.textContent = fmtDuration(p.durationMs);
      }
      this.listEl.scrollTop = this.listEl.scrollHeight;
    }

    end(p) {
      this.steps.forEach((item) => {
        if (item.el.classList.contains("is-active")) {
          item.el.classList.remove("is-active");
          item.el.classList.add("is-done");
          item.timeEl.textContent = "完成";
        }
      });
      if (!this.steps.size) {
        const empty = document.createElement("div");
        empty.className = "ht-tl-empty";
        empty.textContent = "任务完成";
        this.listEl.appendChild(empty);
      }
      this.listEl.scrollTop = this.listEl.scrollHeight;
    }

    destroy() {
      if (!this.bus.off) return;
      this.bus.off("task:start", this._onStart);
      this.bus.off("task:step", this._onStep);
      this.bus.off("task:end", this._onEnd);
      this.bus.off("task:reset", this._onReset);
    }
  }

  UI.Timeline = Timeline;
})(window);
