/* global window */
(function (global) {
  "use strict";
  const UI = (global.XiaomiHomeUI = global.XiaomiHomeUI || {});
  const C = UI.COPY;
  const ROOM_ORDER = { 客厅: 0, 卧室: 1, 书房: 2, living: 0, bedroom: 1, study: 2 };

  class MemoryPanel {
    constructor(bus, root, options) {
      this.bus = bus;
      this.root = root;
      this.options = options || {};
      this.catalog = this.options.catalog || {};
      this.listEl = root.querySelector(".ht-memory-list");
      this.countEl = root.querySelector(".ht-count");
      this.emptyEl = root.querySelector(".ht-mem-empty");
      this.records = new Map();
      this.prev = new Map();
      this.foundId = null;
      this._subscribe();
      this.render();
    }

    _subscribe() {
      this._onUpdated = (p) => this.update(p);
      this._onHit = (p) => this.hit(p);
      this._onMiss = (p) => this.miss(p);
      this._onTaskStart = () => {
        this.foundId = null;
        this.markFound();
      };
      this.bus.on("memory:updated", this._onUpdated);
      this.bus.on("memory:hit", this._onHit);
      this.bus.on("memory:miss", this._onMiss);
      this.bus.on("task:start", this._onTaskStart);
    }

    update(p) {
      if (!p || typeof p.objectId !== "string" || !p.objectId) return;
      const prev = this.records.get(p.objectId);
      const room = typeof p.room === "string" ? p.room : prev ? prev.room : C.memory.unknownRoom;
      const confidence = typeof p.confidence === "number" && isFinite(p.confidence) ? p.confidence : prev ? prev.confidence : 0;
      const status = typeof p.status === "string" ? p.status : prev ? prev.status : "fresh";
      this.records.set(p.objectId, { objectId: p.objectId, room, confidence, status });
      this.render(p.objectId);
    }

    hit(p) {
      if (!p || typeof p.objectId !== "string" || !p.objectId) return;
      const prev = this.records.get(p.objectId);
      const confidence = typeof p.confidence === "number" && isFinite(p.confidence)
        ? p.confidence
        : prev ? prev.confidence : 0;
      this.records.set(p.objectId, {
        objectId: p.objectId,
        room: prev ? prev.room : C.memory.unknownRoom,
        confidence,
        status: "fresh",
      });
      this.foundId = p.objectId;
      this.render(p.objectId);
    }

    miss(p) {
      if (!p || typeof p.objectId !== "string" || !p.objectId) return;
      const prev = this.records.get(p.objectId);
      const confidence = typeof p.confidence === "number" && isFinite(p.confidence)
        ? p.confidence
        : prev ? Math.max(0, prev.confidence - 0.4) : 0;
      this.records.set(p.objectId, {
        objectId: p.objectId,
        room: prev ? prev.room : C.memory.unknownRoom,
        confidence,
        status: "stale",
      });
      this.render(p.objectId);
    }

    meta(id) {
      return this.catalog[id] || {};
    }

    render(flashId) {
      const list = Array.from(this.records.values()).sort((a, b) => {
        const ra = ROOM_ORDER[a.room] === undefined ? 9 : ROOM_ORDER[a.room];
        const rb = ROOM_ORDER[b.room] === undefined ? 9 : ROOM_ORDER[b.room];
        if (ra !== rb) return ra - rb;
        return this.meta(a.objectId).name?.localeCompare?.(this.meta(b.objectId).name || b.objectId, "zh") ||
          String(a.objectId).localeCompare(String(b.objectId), "zh");
      });
      this.countEl.textContent = String(list.length);
      this.listEl.innerHTML = "";
      if (!list.length) {
        this.emptyEl.style.display = "";
        this.prev.clear();
        return;
      }
      this.emptyEl.style.display = "none";
      const nextPrev = new Map();
      for (const rec of list) {
        const id = rec.objectId;
        const meta = this.meta(id);
        const conf = Math.max(0, Math.min(1, rec.confidence));
        const status = rec.status || "fresh";
        const el = document.createElement("div");
        el.className = "ht-mem-item";
        el.dataset.id = id;
        if (conf >= 0.7) el.classList.add("is-high");
        else if (conf >= 0.3) el.classList.add("is-mid");
        else el.classList.add("is-low");
        if (status === "stale") el.classList.add("is-stale");
        if (id === this.foundId) el.classList.add("is-found");

        const prev = this.prev.get(id);
        const changed = prev && (
          Math.abs(prev.confidence - conf) > 0.001 ||
          prev.room !== rec.room ||
          prev.status !== status ||
          id === flashId
        );
        if (changed) el.classList.add("is-flash");

        const swatch = document.createElement("span");
        swatch.className = "ht-mem-swatch";
        swatch.style.background = meta.color || "#b9a897";
        const body = document.createElement("div");
        body.className = "ht-mem-body";
        const row = document.createElement("div");
        row.className = "ht-mem-row";
        const name = document.createElement("span");
        name.className = "ht-mem-name";
        name.textContent = meta.name || id;
        const badge = document.createElement("span");
        badge.className = "ht-mem-room";
        badge.textContent = rec.room + (meta.furniture ? " · " + meta.furniture : "");
        row.appendChild(name);
        row.appendChild(badge);
        const sub = document.createElement("div");
        sub.className = "ht-mem-sub";
        const bar = document.createElement("div");
        bar.className = "ht-conf";
        const fill = document.createElement("i");
        fill.style.width = Math.round(conf * 100) + "%";
        bar.appendChild(fill);
        const num = document.createElement("span");
        num.className = "ht-conf-num";
        num.textContent = Math.round(conf * 100) + "%";
        sub.appendChild(bar);
        if (status === "stale") {
          const stale = document.createElement("span");
          stale.className = "ht-mem-badge";
          stale.textContent = C.memory.stale;
          sub.appendChild(stale);
        }
        sub.appendChild(num);
        body.appendChild(row);
        body.appendChild(sub);
        el.appendChild(swatch);
        el.appendChild(body);
        if (changed) setTimeout(() => el.classList.remove("is-flash"), 1100);
        this.listEl.appendChild(el);
        nextPrev.set(id, { confidence: conf, room: rec.room, status });
      }
      this.prev = nextPrev;
    }

    get(id) {
      return this.records.get(id);
    }

    flash(id) {
      const el = Array.from(this.listEl.querySelectorAll(".ht-mem-item")).find((item) => item.dataset.id === id);
      if (!el) return;
      el.classList.remove("is-flash");
      void el.offsetWidth;
      el.classList.add("is-flash");
      setTimeout(() => el.classList.remove("is-flash"), 1100);
    }

    markFound() {
      this.listEl.querySelectorAll(".ht-mem-item").forEach((el) => {
        el.classList.toggle("is-found", el.dataset.id === this.foundId);
      });
    }

    reset() {
      this.records.clear();
      this.prev.clear();
      this.foundId = null;
      this.render();
    }

    destroy() {
      if (!this.bus.off) return;
      this.bus.off("memory:updated", this._onUpdated);
      this.bus.off("memory:hit", this._onHit);
      this.bus.off("memory:miss", this._onMiss);
      this.bus.off("task:start", this._onTaskStart);
    }
  }

  UI.MemoryPanel = MemoryPanel;
})(window);
