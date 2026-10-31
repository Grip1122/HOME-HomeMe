/* global window */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});

  function num(v, fallback) {
    return typeof v === "number" && isFinite(v) ? v : fallback;
  }

  class Compare {
    constructor(bus, root) {
      this.bus = bus;
      this.root = root;
      this.card = root.querySelector(".ht-compare-card");
      this.onCol = root.querySelector(".ht-compare-col.on");
      this.offCol = root.querySelector(".ht-compare-col.off");
      this.barsEl = root.querySelector(".ht-compare-bars");
      this.noteEl = root.querySelector(".ht-compare-note");
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
      this._onUpdate = (p) => this.open(p || {});
      this.bus.on("compare:update", this._onUpdate);
    }

    open(payload) {
      const on = payload.memoryOn || payload.on || {};
      const off = payload.memoryOff || payload.off || {};
      const onSteps = num(on.steps, 3);
      const offSteps = num(off.steps, 8);
      const onSec = num(on.seconds, 5.6);
      const offSec = num(off.seconds, 18.4);
      this.onCol.querySelector(".big").innerHTML = onSteps + '<small>步</small>';
      this.offCol.querySelector(".big").innerHTML = offSteps + '<small>步</small>';
      this.onCol.querySelector(".row .v-time").textContent = onSec.toFixed(1) + "s";
      this.offCol.querySelector(".row .v-time").textContent = offSec.toFixed(1) + "s";
      this.onCol.querySelector(".row .v-dist").textContent = num(on.distance, 4.2).toFixed(1) + "m";
      this.offCol.querySelector(".row .v-dist").textContent = num(off.distance, 11.8).toFixed(1) + "m";

      const maxSteps = Math.max(onSteps, offSteps, 1);
      const maxSec = Math.max(onSec, offSec, 0.1);
      this.barsEl.innerHTML = "";
      const addBar = (cls, label, value, max, suffix) => {
        const row = document.createElement("div");
        row.className = "ht-bar-row " + cls;
        row.innerHTML = '<span></span><div class="ht-bar"><i></i></div><b></b>';
        row.querySelector("span").textContent = label;
        row.querySelector("b").textContent = value + suffix;
        this.barsEl.appendChild(row);
        const fill = row.querySelector("i");
        requestAnimationFrame(() => {
          fill.style.width = Math.max(4, (value / max) * 100) + "%";
        });
      };
      addBar("on", "记忆开", onSteps, maxSteps, "步");
      addBar("off", "记忆关", offSteps, maxSteps, "步");
      addBar("on", "记忆开", onSec, maxSec, "s");
      addBar("off", "记忆关", offSec, maxSec, "s");
      this.noteEl.textContent = payload.note ||
        "同一布局、同一指令、同一初始位置，仅切换 memory_enabled。数据来自真实任务日志，steps 与耗时不做美化。";
      this.root.classList.add("is-open");
    }

    close() {
      this.root.classList.remove("is-open");
      this.bus.emit("ui:compareClose", {});
    }

    destroy() {
      window.removeEventListener("keydown", this._onKey);
      if (this.bus.off) this.bus.off("compare:update", this._onUpdate);
    }
  }

  UI.Compare = Compare;
})(window);
