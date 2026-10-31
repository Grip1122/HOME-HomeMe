/* global window */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});

  const STATE_LABEL = {
    idle: "待机 · 我在呢",
    thinking: "思考中 · 正在理解",
    walking: "前往中 · 正在走路",
    scanning: "观察中 · 正在环顾",
    picking: "拿取中 · 抓住物品",
    placing: "放置中 · 正在放下",
    confused: "困惑 · 记忆对不上",
    celebrating: "完成 · 找到啦",
    correct: "纠正中 · 记住新位置",
    offline: "离线 · 本机运行",
    error: "异常 · 请重试",
  };

  const SOURCE_LABEL = {
    cache: "缓存命中",
    llm: "在线规划",
    online: "在线规划",
    rule: "规则解析",
    offline: "离线脚本",
    seed: "预置脚本",
  };

  class Status {
    constructor(bus, root) {
      this.bus = bus;
      this.root = root;
      this.stateEl = root.querySelector(".ht-state-text");
      this.dotEl = root.querySelector(".ht-state-dot");
      this.sourceEl = root.querySelector(".ht-source-badge");
      this.stepEl = root.querySelector(".ht-step-indicator");
      this.progressEl = root.querySelector(".ht-progress i");
      this.total = 0;
      this.index = 0;
      this._subscribe();
    }

    _subscribe() {
      this._handlers = {
        "robot:state": (p) => this.setState(p && p.state, p && p.text),
        "task:start": (p) => this.startTask(p || {}),
        "task:step": (p) => this.updateStep(p || {}),
        "task:end": (p) => this.endTask(p || {}),
        "task:reset": () => this.reset(),
        "plan:received": (p) => this.setSource(p && p.source, p && p.latencyMs),
        "plan:degraded": () => this.setSource("rule", null),
      };
      Object.keys(this._handlers).forEach((k) => this.bus.on(k, this._handlers[k]));
    }

    setState(state, text) {
      this.stateEl.textContent = text || STATE_LABEL[state] || state || "待机";
      this.dotEl.className = "ht-state-dot " + (state || "");
    }

    setSource(source, latency) {
      if (!source) return;
      const label = SOURCE_LABEL[source] || source;
      this.sourceEl.textContent = latency ? label + " · " + Math.round(latency) + "ms" : label;
      this.sourceEl.dataset.source = source;
    }

    startTask(payload) {
      this.total = payload.total || payload.stepCount || 0;
      this.index = 0;
      this.setSource(payload.source || "rule", payload.latencyMs);
      this.stepEl.textContent = this.total ? "0/" + this.total + " 步" : "准备中";
      this.progressEl.style.width = "0%";
      if (!payload.state) this.setState("thinking");
    }

    updateStep(payload) {
      if (payload.total) this.total = payload.total;
      if (payload.index !== undefined) this.index = payload.index;
      if (payload.status === "active") {
        const label = payload.label || payload.action || "执行";
        this.stepEl.textContent = "第 " + (this.index + 1) + "/" + (this.total || "?") + " 步 · " + label;
        if (this.total) this.progressEl.style.width = ((this.index + 0.35) / this.total) * 100 + "%";
        if (payload.state) this.setState(payload.state);
      } else if (payload.status === "done") {
        if (this.total) this.progressEl.style.width = ((this.index + 1) / this.total) * 100 + "%";
      }
    }

    endTask(payload) {
      this.progressEl.style.width = "100%";
      const sec = payload.durationMs ? (payload.durationMs / 1000).toFixed(1) + "s" : "";
      this.stepEl.textContent = "完成 · " + (payload.stepCount || this.total || this.index) + " 步" + (sec ? " / " + sec : "");
      this.setState(payload.found ? "celebrating" : "idle");
    }

    reset() {
      this.total = 0;
      this.index = 0;
      this.stepEl.textContent = "等待指令";
      this.progressEl.style.width = "0%";
      this.setState("idle");
    }

    destroy() {
      if (!this.bus.off) return;
      Object.keys(this._handlers || {}).forEach((k) => this.bus.off(k, this._handlers[k]));
    }
  }

  UI.Status = Status;
})(window);
