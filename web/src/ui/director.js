/* global window */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});
  const C = UI.COPY;

  class Director {
    constructor(bus, root, options) {
      this.bus = bus;
      this.root = root;
      this.options = options || {};
      this.backdrop = root.querySelector(".ht-director-backdrop");
      this.drawer = root.querySelector(".ht-director");
      this.openBtn = root.querySelector(".ht-director-open");
      this.closeBtn = root.querySelector(".ht-director-close");
      this.memoryToggle = root.querySelector(".ht-director-memory");
      this.getMemoryEnabled = this.options.getMemoryEnabled || (() => true);
      this.onMemoryChange = this.options.setMemoryEnabled || (() => {});
      this.getLayoutId = this.options.getLayoutId || (() => "A");
      this.onCompare = this.options.onCompare || (() => {});
      this.onToast = this.options.onToast || (() => {});
      this._bind();
    }

    _bind() {
      if (this.openBtn) this.openBtn.addEventListener("click", () => this.toggle());
      if (this.closeBtn) this.closeBtn.addEventListener("click", () => this.close());
      if (this.backdrop) this.backdrop.addEventListener("click", () => this.close());
      this.drawer.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => this.run(btn.dataset.action));
      });
      if (this.memoryToggle) {
        this.memoryToggle.addEventListener("change", () => {
          this.changeMemory(this.memoryToggle.checked);
        });
      }
      this._onKey = (e) => {
        const tag = ((e.target && e.target.tagName) || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || (e.target && e.target.isContentEditable)) return;
        if (e.key === "d" || e.key === "D") {
          e.preventDefault();
          this.toggle();
        } else if (e.key === "Escape") {
          this.close();
        }
      };
      window.addEventListener("keydown", this._onKey);
    }

    run(action) {
      switch (action) {
        case "query:first":
          this.changeMemory(false);
          this.bus.emit("plan:request", { query: C.director.queries.first, memoryEnabled: false });
          this.close();
          break;
        case "query:memory":
          this.changeMemory(true);
          this.bus.emit("plan:request", { query: C.director.queries.memory, memoryEnabled: true });
          this.close();
          break;
        case "teleport:moved":
          this.bus.emit("demo:teleport", { objectId: C.director.movedObjectId, to: C.director.movedTo });
          this.close();
          break;
        case "query:correct":
          this.changeMemory(true);
          this.bus.emit("plan:request", { query: C.director.queries.correct, memoryEnabled: true });
          this.close();
          break;
        case "compare":
          this.onCompare();
          this.close();
          break;
        case "reset":
          this.bus.emit("demo:reset", { layoutId: this.getLayoutId() });
          this.close();
          break;
        default:
          break;
      }
    }

    toggle() {
      if (this.drawer.classList.contains("is-open")) this.close();
      else this.open();
    }

    open() {
      this.drawer.classList.add("is-open");
      this.backdrop.classList.add("is-open");
      this.setMemoryCheckbox(this.getMemoryEnabled());
    }

    close() {
      this.drawer.classList.remove("is-open");
      this.backdrop.classList.remove("is-open");
    }

    setMemory(enabled) {
      this.setMemoryCheckbox(enabled);
    }

    changeMemory(enabled) {
      this.setMemoryCheckbox(enabled);
      this.onMemoryChange(enabled);
    }

    setMemoryCheckbox(enabled) {
      if (this.memoryToggle) this.memoryToggle.checked = !!enabled;
    }

    destroy() {
      window.removeEventListener("keydown", this._onKey);
    }
  }

  UI.Director = Director;
})(window);
