/* global window */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});

  class Director {
    constructor(bus, root) {
      this.bus = bus;
      this.root = root;
      this.backdrop = root.querySelector(".ht-director-backdrop");
      this.drawer = root.querySelector(".ht-director");
      this.openBtn = root.querySelector(".ht-director-open");
      this.closeBtn = root.querySelector(".ht-director-close");
      this.memoryToggle = root.querySelector(".ht-director-memory");
      this._bind();
    }

    _bind() {
      if (this.openBtn) this.openBtn.addEventListener("click", () => this.toggle());
      if (this.closeBtn) this.closeBtn.addEventListener("click", () => this.close());
      if (this.backdrop) this.backdrop.addEventListener("click", () => this.close());
      this.drawer.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const action = btn.dataset.action;
          this.bus.emit("ui:director", { action });
          if (action.indexOf("script:") === 0 || action === "reset") this.close();
        });
      });
      if (this.memoryToggle) {
        this.memoryToggle.addEventListener("change", () => {
          this.bus.emit("ui:director", { action: "memory:toggle", enabled: this.memoryToggle.checked });
        });
      }
      this._onKey = (e) => {
        const tag = (e.target && e.target.tagName || "").toLowerCase();
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

    toggle() {
      if (this.drawer.classList.contains("is-open")) this.close();
      else this.open();
    }

    open() {
      this.drawer.classList.add("is-open");
      this.backdrop.classList.add("is-open");
    }

    close() {
      this.drawer.classList.remove("is-open");
      this.backdrop.classList.remove("is-open");
    }

    setMemory(enabled) {
      if (this.memoryToggle) this.memoryToggle.checked = !!enabled;
    }

    destroy() {
      window.removeEventListener("keydown", this._onKey);
    }
  }

  UI.Director = Director;
})(window);
