/* 小觅HOME · ESM 入口
 * 团队 Vite 项目可直接：
 *   import { createHud } from "./ui/index.mjs";
 *   import "./ui/hud.css";
 *
 * 也可以按顺序用 <script> 加载各文件（见 README）。
 */
import "./copy.js";
import "./chat.js";
import "./status.js";
import "./memory-panel.js";
import "./timeline.js";
import "./compare.js";
import "./voice.js";
import "./director.js";
import "./hud.js";

const UI = window.XiaomiHomeUI;

export const createHud = UI.createHud;
export const version = UI.version;
export const COPY = UI.COPY;
export const Chat = UI.Chat;
export const Status = UI.Status;
export const MemoryPanel = UI.MemoryPanel;
export const Timeline = UI.Timeline;
export const Compare = UI.Compare;
export const Voice = UI.Voice;
export const Director = UI.Director;
