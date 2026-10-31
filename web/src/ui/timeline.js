/* global window */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});
  const C = UI.COPY;

  function fmtMs(ms) {
    if (!Number.isFinite(ms)) return C.timeline.noMs;
    if (ms < 1000) return Math.round(ms) + "ms";
    return (ms / 1000).toFixed(1) + "s";
  }

  class Timeline {
    constructor(bus, root, options) {
      this.bus = bus;
      this.root = root;
      this.listEl = root;
      this.options = options || {};
      this.steps = new Map();
      this.plannedTotal = 0;
      this.taskId = null;
      this.invalidCount = 0;
      this._subscribe();
    }

    _subscribe() {
      this._onPlan = (p) => {
        if (p && Array.isArray(p.steps)) this.plannedTotal = p.steps.length;
      };
      this._onStart = (p) => this.start(p || {});
      this._onStep = (p) => this.update(p || {});
      this._onEnd = (p) => this.end(p || {});
      this.bus.on("plan:received", this._onPlan);
      this.bus.on("task:start", this._onStart);
      this.bus.on("task:step", this._onStep);
      this.bus.on("task:end", this._onEnd);
    }

    start(payload) {
      this.listEl.innerHTML = "";
      this.steps.clear();
      this.invalidCount = 0;
      this.taskId = payload && payload.taskId ? payload.taskId : null;
      this.addSummary(C.timeline.preparing, "ht-tl-empty");
    }

    update(p) {
      if (!p || typeof p.index !== "number") {
        this.invalidCount += 1;
        this.addStep("invalid-" + this.invalidCount, C.timeline.badPayload, "", C.timeline.badPayload, false, true);
        return;
      }
      const ok = p.ok === true;
      const failed = p.ok === false;
      const unknown = typeof p.ok !== "boolean";
      const action = p.action || "";
      const label = C.timeline.actionLabels[action] || action || C.timeline.badPayload;
      const target = this.targetLabel(p.target);
      const title = target ? label + " · " + target : label;
      const sub = unknown ? C.timeline.badPayload : failed ? C.timeline.failedHint : C.timeline.success;
      this.addStep(String(p.index), title, target, sub, !failed && !unknown, failed || unknown, p.ms);
    }

    targetLabel(target) {
      if (!target) return "";
      if (this.options.objectNames && this.options.objectNames[target]) return this.options.objectNames[target];
      return String(target);
    }

    addStep(key, title, target, sub, ok, failed, ms) {
      const empty = this.listEl.querySelector(".ht-tl-empty");
      if (empty) empty.remove();
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
      item.titleEl.textContent = title;
      item.subEl.textContent = sub || "";
      item.timeEl.textContent = fmtMs(ms);
      item.el.classList.remove("is-active", "is-done", "is-error");
      if (failed) item.el.classList.add("is-error");
      else if (ok) item.el.classList.add("is-done");
      else item.el.classList.add("is-active");
      this.listEl.scrollTop = this.listEl.scrollHeight;
    }

    addSummary(text, className) {
      const el = document.createElement("div");
      el.className = className || "ht-tl-summary";
      el.textContent = text;
      this.listEl.appendChild(el);
      this.listEl.scrollTop = this.listEl.scrollHeight;
    }

    end(p) {
      const total = this.plannedTotal || 0;
      const observed = [...this.steps.values()];
      const steps = p && p.ok === false && observed.length
        ? observed.filter((item) => item.el.classList.contains("is-done")).length
        : p && Number.isFinite(p.steps) ? p.steps : this.steps.size;
      const duration = fmtMs(p && p.durationMs);
      let text;
      if (!p || typeof p.ok !== "boolean") text = C.timeline.summaryUnknown;
      else if (p.ok) text = C.timeline.summaryDone(steps, duration);
      else text = C.timeline.summaryInterrupted(steps, total);
      this.addSummary(text, "ht-tl-summary" + (p && p.ok === false ? " is-error" : ""));
    }

    reset() {
      this.listEl.innerHTML = "";
      this.steps.clear();
      this.invalidCount = 0;
      this.plannedTotal = 0;
      this.taskId = null;
      this.addSummary(C.timeline.empty, "ht-tl-empty");
    }

    destroy() {
      if (!this.bus.off) return;
      this.bus.off("plan:received", this._onPlan);
      this.bus.off("task:start", this._onStart);
      this.bus.off("task:step", this._onStep);
      this.bus.off("task:end", this._onEnd);
    }
  }

  UI.Timeline = Timeline;
})(window);
