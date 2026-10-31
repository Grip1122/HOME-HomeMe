/* global window */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});
  const C = UI.COPY;

  function finite(v) {
    return typeof v === "number" && isFinite(v);
  }

  function normalizeQuery(q) {
    return String(q || "").replace(/[\s，。！？、,.!?;；:：“”‘’（）()【】\[\]]/g, "");
  }

  class Compare {
    constructor(bus, root) {
      this.bus = bus;
      this.root = root;
      this.card = root.querySelector(".ht-compare-card");
      this.onCol = root.querySelector(".ht-compare-col.on");
      this.offCol = root.querySelector(".ht-compare-col.off");
      this.barsEl = root.querySelector(".ht-compare-bars");
      this.emptyEl = root.querySelector(".ht-compare-empty");
      this.noteEl = root.querySelector(".ht-compare-note");
      this.subEl = root.querySelector(".ht-compare-sub");
      this.history = [];
      this.pending = new Map();
      this.lastRequest = null;
      this._bind();
      this._subscribe();
    }

    _bind() {
      this.root.querySelector(".ht-compare-close").addEventListener("click", () => this.close());
      this.root.addEventListener("click", (e) => {
        if (e.target === this.root) this.close();
      });
      this._onKey = (e) => {
        if (e.key === "Escape" && this.root.classList.contains("is-open")) this.close();
      };
      window.addEventListener("keydown", this._onKey);
    }

    _subscribe() {
      this._onRequest = (p) => {
        if (p && typeof p.query === "string" && typeof p.memoryEnabled === "boolean") {
          this.lastRequest = { query: p.query, memoryEnabled: p.memoryEnabled };
        } else {
          this.lastRequest = null;
        }
      };
      this._onStart = (p) => {
        if (!p || !p.taskId) return;
        this.pending.set(p.taskId, {
          query: this.lastRequest ? this.lastRequest.query : null,
          memoryEnabled: this.lastRequest ? this.lastRequest.memoryEnabled : null,
        });
      };
      this._onEnd = (p) => {
        if (!p || !p.taskId || typeof p.ok !== "boolean" || !finite(p.steps) || !finite(p.durationMs)) return;
        const meta = this.pending.get(p.taskId) || {};
        this.history.push({
          taskId: p.taskId,
          query: meta.query || null,
          memoryEnabled: meta.memoryEnabled === undefined ? null : meta.memoryEnabled,
          ok: p.ok,
          steps: p.steps,
          durationMs: p.durationMs,
        });
        // Keep the session bounded; comparison only needs the latest pair.
        if (this.history.length > 40) this.history.splice(0, this.history.length - 40);
        this.pending.delete(p.taskId);
      };
      this.bus.on("plan:request", this._onRequest);
      this.bus.on("task:start", this._onStart);
      this.bus.on("task:end", this._onEnd);
    }

    findPair() {
      const valid = this.history.filter(
        (e) => e.ok === true && typeof e.memoryEnabled === "boolean" && (e.query === null || normalizeQuery(e.query))
      );
      const groups = new Map();
      for (const e of valid) {
        const key = e.query ? normalizeQuery(e.query) : "__unknown__";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(e);
      }
      for (const list of groups.values()) {
        const on = list.filter((e) => e.memoryEnabled === true).slice(-1)[0];
        const off = list.filter((e) => e.memoryEnabled === false).slice(-1)[0];
        if (on && off) return { on, off };
      }
      return null;
    }

    open() {
      const pair = this.findPair();
      this.root.classList.add("is-open");
      if (pair) {
        this._setSub(C.compare.sub);
        this.render(pair.on, pair.off, C.compare.realNote);
      } else {
        this.showEmpty();
      }
    }

    setData(data, opts) {
      opts = opts || {};
      const on = data && data.memoryOn;
      const off = data && data.memoryOff;
      const toMs = (x) => {
        if (!x) return null;
        if (finite(x.durationMs)) return x.durationMs;
        if (finite(x.seconds)) return x.seconds * 1000;
        return null;
      };
      if (!on || !off || !finite(on.steps) || !finite(off.steps) || toMs(on) === null || toMs(off) === null) {
        this.showEmpty();
        return false;
      }
      const note = opts.preview
        ? C.compare.previewNote
        : data.note || C.compare.realNote;
      this._setSub(opts.preview ? C.compare.previewSub : C.compare.sub);
      this.render(
        { steps: on.steps, durationMs: toMs(on) },
        { steps: off.steps, durationMs: toMs(off) },
        note
      );
      return true;
    }

    render(on, off, note) {
      this.root.classList.remove("is-empty");
      this.root.classList.add("is-open");
      if (this.emptyEl) this.emptyEl.hidden = true;
      const setBig = (col, value) => {
        const el = col.querySelector(".big");
        el.textContent = "";
        el.appendChild(document.createTextNode(String(value)));
        const small = document.createElement("small");
        small.textContent = C.compare.steps;
        el.appendChild(small);
      };
      setBig(this.onCol, on.steps);
      setBig(this.offCol, off.steps);
      this.onCol.querySelector(".v-time").textContent = (on.durationMs / 1000).toFixed(1) + "s";
      this.offCol.querySelector(".v-time").textContent = (off.durationMs / 1000).toFixed(1) + "s";

      const maxSteps = Math.max(on.steps, off.steps, 1);
      const maxSec = Math.max(on.durationMs / 1000, off.durationMs / 1000, 0.1);
      this.barsEl.innerHTML = "";
      const addBar = (cls, label, value, max, suffix) => {
        const row = document.createElement("div");
        row.className = "ht-bar-row " + cls;
        row.innerHTML = '<span></span><div class="ht-bar"><i></i></div><b></b>';
        row.querySelector("span").textContent = label;
        row.querySelector("b").textContent = value + suffix;
        this.barsEl.appendChild(row);
        const fill = row.querySelector("i");
        const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
        raf(() => {
          fill.style.width = Math.max(4, (value / max) * 100) + "%";
        });
      };
      addBar("on", C.compare.on, on.steps, maxSteps, C.compare.steps);
      addBar("off", C.compare.off, off.steps, maxSteps, C.compare.steps);
      addBar("on", C.compare.on, on.durationMs / 1000, maxSec, "s");
      addBar("off", C.compare.off, off.durationMs / 1000, maxSec, "s");
      this.noteEl.textContent = note;
    }

    showEmpty() {
      this.root.classList.add("is-open", "is-empty");
      this._setSub(C.compare.sub);
      if (this.emptyEl) this.emptyEl.hidden = false;
      for (const col of [this.onCol, this.offCol]) {
        const big = col.querySelector(".big");
        big.textContent = C.compare.noValue;
        col.querySelector(".v-time").textContent = C.compare.noValue;
      }
      this.barsEl.innerHTML = "";
      this.noteEl.textContent = C.compare.emptySub;
    }

    _setSub(text) {
      if (this.subEl) this.subEl.textContent = text;
    }

    close() {
      this.root.classList.remove("is-open");
    }

    resetHistory() {
      this.history = [];
      this.pending.clear();
      this.lastRequest = null;
    }

    destroy() {
      window.removeEventListener("keydown", this._onKey);
      if (this.bus.off) {
        this.bus.off("plan:request", this._onRequest);
        this.bus.off("task:start", this._onStart);
        this.bus.off("task:end", this._onEnd);
      }
    }
  }

  UI.Compare = Compare;
})(window);
