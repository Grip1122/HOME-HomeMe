/* global window */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});
  const C = UI.COPY;

  function nowLabel() {
    return new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" });
  }

  class Chat {
    constructor(bus, root, options) {
      this.bus = bus;
      this.root = root;
      this.options = options || {};
      this.messagesEl = root.querySelector(".ht-chat-messages");
      this.formEl = root.querySelector(".ht-chat-bar");
      this.inputEl = root.querySelector(".ht-chat-input");
      this.sendEl = root.querySelector(".ht-send-btn");
      this.typingEl = null;
      this.busy = false;
      this.lastUser = { text: "", at: 0 };
      this.getMemoryEnabled = this.options.getMemoryEnabled || (() => true);
      this.onToast = this.options.onToast || (() => {});
      this._bind();
      this._subscribe();
    }

    _subscribe() {
      this._onRequest = (p) => {
        if (!p || typeof p.query !== "string" || !p.query.trim()) return;
        this.addUser(p.query.trim());
        this.setTyping(true);
        this.setBusy(true);
      };
      this._onSay = (p) => {
        if (!p || typeof p.text !== "string") return;
        if (p.who === "user") this.addUser(p.text);
        else this.addMessage("robot", p.text);
        this.setTyping(false);
      };
      this._onPlanReceived = () => this.setTyping(false);
      this._onPlanRejected = (p) => {
        this.setTyping(false);
        this.setBusy(false);
        const reason = p && p.reason ? "：" + p.reason : "";
        this.addMessage("robot", C.chat.planRejected + reason);
      };
      this._onTaskStart = () => {
        this.setTyping(false);
        this.setBusy(true);
      };
      this._onTaskEnd = () => {
        this.setTyping(false);
        this.setBusy(false);
      };
      this.bus.on("plan:request", this._onRequest);
      this.bus.on("task:say", this._onSay);
      this.bus.on("plan:received", this._onPlanReceived);
      this.bus.on("plan:rejected", this._onPlanRejected);
      this.bus.on("task:start", this._onTaskStart);
      this.bus.on("task:end", this._onTaskEnd);
    }

    _bind() {
      this.formEl.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submit();
      });
      this.sendEl.addEventListener("click", (e) => {
        e.preventDefault();
        this.submit();
      });
      this.root.querySelectorAll(".ht-sug").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (this.busy) {
            this.onToast(C.chat.busy, "warn");
            return;
          }
          this.send(btn.dataset.query || btn.textContent.trim());
        });
      });
    }

    submit() {
      const text = (this.inputEl.value || "").trim();
      if (!text) return;
      if (this.busy) {
        this.onToast(C.chat.busy, "warn");
        return;
      }
      this.inputEl.value = "";
      this.send(text);
    }

    send(text) {
      this.bus.emit("plan:request", { query: text, memoryEnabled: !!this.getMemoryEnabled() });
    }

    addUser(text) {
      const now = Date.now();
      if (this.lastUser.text === text && now - this.lastUser.at < 1500) return;
      this.lastUser = { text, at: now };
      this.addMessage("user", text);
    }

    addMessage(role, text) {
      this.setTyping(false);
      const wrap = document.createElement("div");
      wrap.className = "ht-msg " + (role === "user" ? "user" : "butler");
      const avatar = document.createElement("span");
      avatar.className = "ht-msg-avatar";
      avatar.textContent = role === "user" ? C.chat.avatarUser : C.chat.avatarRobot;
      const bubble = document.createElement("div");
      bubble.className = "ht-bubble";
      bubble.textContent = text;
      const meta = document.createElement("span");
      meta.className = "ht-msg-meta";
      meta.textContent = nowLabel();
      bubble.appendChild(meta);
      wrap.appendChild(avatar);
      wrap.appendChild(bubble);
      this.messagesEl.appendChild(wrap);
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      return wrap;
    }

    setTyping(on) {
      if (on) {
        if (this.typingEl) return;
        const wrap = document.createElement("div");
        wrap.className = "ht-msg butler";
        wrap.innerHTML =
          '<span class="ht-msg-avatar"></span>' +
          '<div class="ht-bubble"><span class="ht-typing"><i></i><i></i><i></i></span></div>';
        wrap.querySelector(".ht-msg-avatar").textContent = C.chat.avatarRobot;
        this.messagesEl.appendChild(wrap);
        this.typingEl = wrap;
      } else if (this.typingEl) {
        this.typingEl.remove();
        this.typingEl = null;
      }
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    setBusy(busy) {
      this.busy = !!busy;
      this.inputEl.disabled = this.busy;
      this.sendEl.disabled = this.busy;
    }

    clear() {
      this.messagesEl.innerHTML = "";
      this.typingEl = null;
    }

    destroy() {
      if (!this.bus.off) return;
      this.bus.off("plan:request", this._onRequest);
      this.bus.off("task:say", this._onSay);
      this.bus.off("plan:received", this._onPlanReceived);
      this.bus.off("plan:rejected", this._onPlanRejected);
      this.bus.off("task:start", this._onTaskStart);
      this.bus.off("task:end", this._onTaskEnd);
    }
  }

  UI.Chat = Chat;
})(window);
