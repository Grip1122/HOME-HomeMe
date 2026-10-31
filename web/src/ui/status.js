/* global window */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});
  const C = UI.COPY;

  function fmtMs(ms) {
    if (!Number.isFinite(ms)) return C.timeline.durationUnknown;
    if (ms < 1000) return Math.round(ms) + "ms";
    return (ms / 1000).toFixed(1) + "s";
  }

  class Status {
    constructor(bus, root) {
      this.bus = bus;
      this.root = root;
      this.stateEl = root.querySelector(".ht-state-text");
      this.dotEl = root.querySelector(".ht-state-dot");
      this.sourceEl = root.querySelector(".ht-source-badge");
      this.stepEl = root.querySelector(".ht-step-indicator");
      this.progressEl = root.querySelector(".ht-progress i");
      this.plannedTotal = 0;
      this.total = 0;
      this.done = 0;
      this.taskId = null;
      this.hasStepEvents = false;
      this._subscribe();
    }

    _subscribe() {
      this._handlers = {
        "robot:state": (p) => this.onRobotState(p),
        "plan:received": (p) => this.onPlanReceived(p),
        "plan:rejected": (p) => this.onPlanRejected(p),
        "plan:corrected": (p) => this.onPlanCorrected(p),
        "task:start": (p) => this.startTask(p),
        "task:step": (p) => this.updateStep(p),
        "task:end": (p) => this.endTask(p),
        "robot:blocked": (p) => this.onBlocked(p),
      };
      Object.keys(this._handlers).forEach((k) => this.bus.on(k, this._handlers[k]));
    }

    onRobotState(p) {
      if (!p || typeof p.to !== "string") {
        this.setState("error", C.status.unknownState);
        return;
      }
      this.setState(p.to);
    }

    onPlanReceived(p) {
      if (!p) return;
      this.setSource(p.source, p.latencyMs);
      if (Array.isArray(p.steps)) {
        this.plannedTotal = p.steps.length;
        if (!this.total) this.total = this.plannedTotal;
        this.renderProgress();
      }
    }

    onPlanRejected(p) {
      this.stepEl.textContent = p && p.reason ? C.status.planRejected + "：" + p.reason : C.status.planRejected;
      this.progressEl.style.width = "0%";
      this.setState("error", C.status.planRejected);
    }

    onPlanCorrected(p) {
      if (!p) return;
      this.setSource("corrective", null);
    }

    onBlocked(p) {
      const reason = p && p.reason ? p.reason : C.status.blocked;
      this.setState("confused", reason);
    }

    setState(state, text) {
      const known = C.status.states[state];
      this.stateEl.textContent = text || known || state || C.status.unknownState;
      this.dotEl.className = "ht-state-dot " + (known ? state : "error");
    }

    setSource(source, latency) {
      if (!source) return;
      const label = C.status.sources[source] || source;
      this.sourceEl.textContent = Number.isFinite(latency) ? label + " · " + Math.round(latency) + "ms" : label;
      this.sourceEl.dataset.source = source;
    }

    startTask(payload) {
      this.taskId = (payload && payload.taskId) || null;
      this.total = this.plannedTotal || 0;
      this.done = 0;
      this.hasStepEvents = false;
      this.setSource(payload && payload.source, null);
      this.renderProgress();
      this.setState("thinking");
    }

    updateStep(payload) {
      if (!payload || typeof payload.index !== "number" || typeof payload.ok !== "boolean") {
        this.stepEl.textContent = C.status.badStep;
        return;
      }
      const item = payload.index + 1;
      this.hasStepEvents = true;
      this.done = payload.ok ? item : payload.index;
      this.renderProgress(payload.ok ? "" : " · " + C.status.stepFailed);
      if (!payload.ok) this.setState("error", C.status.stepFailed);
    }

    endTask(payload) {
      if (!payload || typeof payload.ok !== "boolean") {
        this.stepEl.textContent = C.timeline.summaryUnknown;
        this.setState("error", C.timeline.summaryUnknown);
        return;
      }
      // A's task:end.steps includes attempted failures; observed step results
      // determine the number successfully completed by this HUD.
      const steps = !payload.ok && this.hasStepEvents
        ? this.done
        : Number.isFinite(payload.steps) ? payload.steps : this.done;
      const total = this.total || 0;
      const duration = fmtMs(payload.durationMs);
      if (payload.ok) {
        this.progressEl.style.width = "100%";
        this.stepEl.textContent = C.timeline.summaryDone(steps, duration);
        this.setState("idle");
      } else {
        const pct = total ? Math.min(100, Math.max(0, (steps / total) * 100)) : 0;
        this.progressEl.style.width = pct + "%";
        this.stepEl.textContent = C.timeline.summaryInterrupted(steps, total);
        this.setState("error", C.timeline.summaryInterrupted(steps, total));
      }
    }

    renderProgress(suffix) {
      const total = this.total || this.plannedTotal || 0;
      if (total) {
        this.progressEl.style.width = Math.min(100, (this.done / total) * 100) + "%";
        this.stepEl.textContent =
          C.status.completed + " " + this.done + "/" + total + " " + C.status.steps + (suffix || "");
      } else {
        this.progressEl.style.width = "0%";
        this.stepEl.textContent =
          this.done === 0
            ? C.status.waiting
            : C.status.completed + " " + this.done + " " + C.status.steps + (suffix || "");
      }
    }

    reset() {
      this.hasStepEvents = false;
      this.plannedTotal = 0;
      this.total = 0;
      this.done = 0;
      this.taskId = null;
      this.stepEl.textContent = C.status.waiting;
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
