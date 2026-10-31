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

export const GRAB_RADIUS = 1.0;      // 水平距离小于它才可抓；与 server/app/layoutlib.py 的 GRAB_RADIUS 一致
export const ROBOT_RADIUS = 0.25;    // A* 外扩半径；与后端 ROBOT_RADIUS 一致
export const WALK_SPEED = 1.2;       // 米/秒
export const CARRY_SCALE = 0.4;      // 携带时物体缩放
export const FADE_SECONDS = 0.25;    // 状态切换动画淡入淡出
export const ACTION_MAX_SECONDS = 0.5; // 抓取/放置动画总时长上限
export const OBSERVE_SECONDS = 1.5;  // 原地环顾一周，演示时可调
export const CONFUSED_SECONDS = 1.2;

export const CAMERA = Object.freeze({
  projection: 'orthographic',
  pitchDeg: 45,
  zoomMin: 0.7,
  zoomMax: 1.5,
});
