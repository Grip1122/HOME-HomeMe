// 全项目唯一的常量来源。相机角度、缩放倍数、距离阈值只许在这里定义（任务书红线 5）。
// 单位：米、秒。

/** 契约 contracts/events.md 声明的 18 个事件，新增须走 contract PR。 */
export const EVENT_NAMES = Object.freeze([
  'robot:state', 'robot:moved', 'robot:blocked', 'robot:holding',
  'task:start', 'task:step', 'task:end', 'task:say',
  'plan:request', 'plan:received', 'plan:rejected', 'plan:corrected',
  'memory:updated', 'memory:hit', 'memory:miss',
  'ui:view', 'demo:reset', 'demo:teleport',
]);

/** 高频事件的最小派发间隔（毫秒）。其余事件是一次性事件，不得节流。 */
export const THROTTLE_MS = Object.freeze({ 'robot:moved': 100 });

// GRAB_RADIUS（1.0，水平距离小于它才可抓）与 ROBOT_RADIUS（0.25，A* 外扩半径）的唯一定义在 nav/grid.js，
// 与 server/app/layoutlib.py 对账；这里转出，动作层统一从 config 取，不另写一份数字。
export { GRAB_RADIUS, ROBOT_RADIUS } from '../nav/grid.js';
export const WALK_SPEED = 1.2;       // 米/秒
export const CARRY_SCALE = 0.4;      // 携带时物体缩放
export const FADE_SECONDS = 0.25;    // 状态切换动画淡入淡出
export const ACTION_MAX_SECONDS = 0.5; // 抓取/放置动画总时长上限
export const OBSERVE_SECONDS = 1.5;  // 原地环顾一周，演示时可调
export const CONFUSED_SECONDS = 1.2;
export const CELEBRATE_SECONDS = 1.0;
export const CARRY_ANCHOR = Object.freeze([0, 0.55, 0.4]); // 携带锚点，相对机器人原点（朝向 +z）；2.1 由设计 B 调校，只改这里
/** 与 server/app/memory.py 的六条置信度规则一致；前端只做本地桩，3.3 起以后端为唯一真值。 */
export const MEMORY = Object.freeze({ OBSERVE: 0.8, HIT: 0.05, MISS: 0.4, MIN_USABLE: 0.3 });
export const TURN_SPEED = 4.0;       // 弧度/秒，每段路径开始前先转身
export const MEMORY_MOVED_EPS = 0.3; // 米，观察到的位置与记忆相差超过它才算"挪过了"

export const CAMERA = Object.freeze({
  projection: 'orthographic',
  pitchDeg: 45,
  zoomMin: 0.7,
  zoomMax: 1.5,
});
