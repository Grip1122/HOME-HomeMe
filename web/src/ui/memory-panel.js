/* global window */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});
  const ROOM_ORDER = { 客厅: 0, 卧室: 1, 书房: 2, living: 0, bedroom: 1, study: 2 };

  function toArray(objects) {
    if (!objects) return [];
    if (Array.isArray(objects)) return objects.slice();
    return Object.keys(objects).map((k) => Object.assign({ object_id: k }, objects[k]));
  }

  function fmtTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" });
  }

  class MemoryPanel {
    constructor(bus, root) {
      this.bus = bus;
      this.root = root;
      this.listEl = root.querySelector(".ht-memory-list");
      this.countEl = root.querySelector(".ht-count");
      this.emptyEl = root.querySelector(".ht-mem-empty");
      this.items = new Map();
      this.prev = new Map();
      this.foundId = null;
      this._bind();
      this._subscribe();
    }

    _subscribe() {
      this._onUpdate = (payload) => {
        const objects = toArray(payload && payload.objects);
        this.render(objects, payload && payload.layoutId);
      };
      this._onHighlight = (payload) => {
        if (payload && payload.objectId) this.flash(payload.objectId);
      };
      this._onFound = (payload) => {
        this.foundId = payload && (payload.objectId || payload.object_id);
        this.markFound();
      };
      this._onTaskStart = () => {
        this.foundId = null;
        this.markFound();
      };
      this.bus.on("memory:update", this._onUpdate);
      this.bus.on("memory:highlight", this._onHighlight);
      this.bus.on("found", this._onFound);
      this.bus.on("task:start", this._onTaskStart);
    }

    _bind() {
      this.listEl.addEventListener("click", (e) => {
        const item = e.target.closest(".ht-mem-item");
        if (!item) return;
        this.bus.emit("ui:focusObject", { objectId: item.dataset.id });
      });
    }

    render(objects, layoutId) {
      this.objects = objects;
      this.layoutId = layoutId || this.layoutId;
      const sorted = objects.slice().sort((a, b) => {
        const ra = ROOM_ORDER[a.room] === undefined ? 9 : ROOM_ORDER[a.room];
        const rb = ROOM_ORDER[b.room] === undefined ? 9 : ROOM_ORDER[b.room];
        if (ra !== rb) return ra - rb;
        return String(a.name || a.object_id).localeCompare(String(b.name || b.object_id), "zh");
      });
      this.countEl.textContent = String(sorted.length);
      this.items.clear();
      this.listEl.innerHTML = "";
      if (!sorted.length) {
        this.emptyEl.style.display = "";
        return;
      }
      this.emptyEl.style.display = "none";
      for (const obj of sorted) {
        const id = obj.object_id || obj.id;
        const conf = obj.confidence === undefined ? 0.8 : Number(obj.confidence);
        const status = obj.status || "fresh";
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
          Math.abs((prev.confidence || 0) - conf) > 0.001 ||
          prev.room !== obj.room ||
          prev.status !== status ||
          String(prev.pos) !== String(obj.pos)
        );
        if (changed) el.classList.add("is-flash");

        const swatch = document.createElement("span");
        swatch.className = "ht-mem-swatch";
        swatch.style.background = obj.color || "#b9a897";

        const body = document.createElement("div");
        body.className = "ht-mem-body";
        const row = document.createElement("div");
        row.className = "ht-mem-row";
        const name = document.createElement("span");
        name.className = "ht-mem-name";
        name.textContent = obj.name || id;
        const badge = document.createElement("span");
        badge.className = "ht-mem-room";
        badge.textContent = (obj.room || "未知") + (obj.furniture ? " · " + obj.furniture : "");
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
          stale.textContent = "待复核";
          sub.appendChild(stale);
        }
        sub.appendChild(num);
        body.appendChild(row);
        body.appendChild(sub);
        el.appendChild(swatch);
        el.appendChild(body);

        if (changed) {
          setTimeout(() => {
            el.classList.remove("is-flash");
          }, 1100);
        }
        this.listEl.appendChild(el);
        this.items.set(id, el);
      }
      this.prev = new Map();
      for (const obj of sorted) {
        const id = obj.object_id || obj.id;
        this.prev.set(id, {
          confidence: obj.confidence,
          room: obj.room,
          status: obj.status,
          pos: obj.pos,
        });
      }
    }

    flash(id) {
      const el = this.items.get(id);
      if (!el) return;
      el.classList.remove("is-flash");
      void el.offsetWidth;
      el.classList.add("is-flash");
      setTimeout(() => el.classList.remove("is-flash"), 1100);
    }

    markFound() {
      this.items.forEach((el, id) => el.classList.toggle("is-found", id === this.foundId));
    }

    destroy() {
      if (!this.bus.off) return;
      this.bus.off("memory:update", this._onUpdate);
      this.bus.off("memory:highlight", this._onHighlight);
      this.bus.off("found", this._onFound);
      this.bus.off("task:start", this._onTaskStart);
    }
  }

  UI.MemoryPanel = MemoryPanel;
})(window);
