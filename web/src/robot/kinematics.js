/**
 * RS-01 履带扫描机器人的运动学纯函数（步骤 1.2 执行层底座）。
 *
 * 来源：`reference/hackerson/web/robot.mjs` 的 `update()` 与 `placeTrack()`。
 * 原实现直接操作 PlayCanvas 节点；这里抽出**可测的数值部分**，渲染层只负责把结果抄到节点上。
 *
 * 约定（与 `assets/robot/manifest.json` 一致）：
 *   - GLB 坐标：X 前、Y 上、Z 右；`profile` 的每个点是 `[forward, up]`（履带侧视轮廓）。
 *   - 场景坐标：x 前、z 右（three.js / PlayCanvas 的 y 向上视角），y 为高度。
 *   - 杆高 0.55–2.30 m，俯仰 ±0.65 rad，履带半轮距 0.128 m，驱动轮半径 0.049 m。
 */

export const MAST = Object.freeze({
  minHeight: 0.55,
  maxHeight: 2.3,
  stages: 4,
  stageSpan: 0.45,
});

export const TRACKS = Object.freeze({
  centerY: 0.128,
  driveRadius: 0.049,
  rollerRadius: 0.052,
  linksPerSide: 42,
});

export const TILT_LIMIT_RAD = 0.65;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 角度归一到 (-π, π]。 */
export function wrapAngle(a) {
  const twoPi = Math.PI * 2;
  return ((((a + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
}

/** 从 from 转到 to 的最短转角（带符号）。 */
export function shortestTurn(from, to) {
  return wrapAngle(to - from);
}

/**
 * 四节伸缩杆的局部 Y 偏移。
 * 第一节固定 0.55 m 底座高度，其余三节以父节点为基准各伸展 extension，
 * 合计高度 = 0.55 + 4 × extension。
 */
export function mastStageOffsets(height) {
  const h = clamp(Number.isFinite(height) ? height : MAST.minHeight, MAST.minHeight, MAST.maxHeight);
  const extension = (h - MAST.minHeight) / MAST.stages;
  const localY = [MAST.minHeight + extension, extension, extension, extension];
  return { height: h, extension, localY, clampApplied: h !== height };
}

/**
 * 差速履带的行程分解。
 * @param {{xy:[number,number], yaw:number}|null} prev 上一帧位姿（null 表示新时间线）
 * @param {{xy:[number,number], yaw:number}} next 当前位姿
 * @param {{centerY?:number, driveRadius?:number, resetDistance?:number, resetTurn?:number}} [opts]
 * @returns {{accepted:boolean, travel:number, turn:number, leftTravel:number, rightTravel:number,
 *            leftAngle:number, rightAngle:number}}
 */
export function treadTravel(prev, next, opts = {}) {
  const centerY = opts.centerY ?? TRACKS.centerY;
  const driveRadius = opts.driveRadius ?? TRACKS.driveRadius;
  const resetDistance = opts.resetDistance ?? 0.4;
  const resetTurn = opts.resetTurn ?? 0.6;
  const zero = { accepted: false, travel: 0, turn: 0, leftTravel: 0, rightTravel: 0, leftAngle: 0, rightAngle: 0 };
  if (!prev || !next) return zero;

  const turn = shortestTurn(prev.yaw ?? 0, next.yaw ?? 0);
  const mid = (prev.yaw ?? 0) + turn / 2;
  const dx = next.xy[0] - prev.xy[0];
  const dz = next.xy[1] - prev.xy[1];
  const travel = dx * Math.cos(mid) + dz * Math.sin(mid);

  // 跳变（瞬移 / 换场景 / 掉帧太久）不参与履带累计，避免履带块位置突跳。
  if (!(Math.abs(travel) < resetDistance) || !(Math.abs(turn) < resetTurn)) return zero;

  const leftTravel = travel - centerY * turn;
  const rightTravel = travel + centerY * turn;
  return {
    accepted: true,
    travel,
    turn,
    leftTravel,
    rightTravel,
    leftAngle: leftTravel / driveRadius,
    rightAngle: rightTravel / driveRadius,
  };
}

/** 闭合轮廓周长；空轮廓返回 0（调用方据此跳过履带动画）。 */
export function profilePerimeter(profile) {
  if (!Array.isArray(profile) || profile.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < profile.length; i += 1) {
    const a = profile[i];
    const b = profile[(i + 1) % profile.length];
    sum += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return sum;
}

/**
 * 一块履带节在轮廓上的位姿。
 * @param {Array<[number, number]>} profile 闭合轮廓（侧视，[forward, up]）
 * @param {number} offset 累计行程（米，可正可负，内部取模）
 * @param {{linksPerSide?:number, index?:number, centerY?:number, side?:1|-1}} [opts]
 * @returns {{forward:number, up:number, lateral:number, yaw:number}|null}
 */
export function treadLinkPose(profile, offset, opts = {}) {
  const perimeter = profilePerimeter(profile);
  if (!perimeter) return null;
  const linksPerSide = opts.linksPerSide ?? TRACKS.linksPerSide;
  const index = opts.index ?? 0;
  const centerY = opts.centerY ?? TRACKS.centerY;
  const side = opts.side ?? 1;

  let distance = ((index * perimeter) / linksPerSide - offset) % perimeter;
  distance = ((distance % perimeter) + perimeter) % perimeter;

  for (let i = 0; i < profile.length; i += 1) {
    const point = profile[i];
    const next = profile[(i + 1) % profile.length];
    const dx = next[0] - point[0];
    const dy = next[1] - point[1];
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    if (distance <= length) {
      const t = distance / length;
      return {
        forward: point[0] + dx * t,
        up: point[1] + dy * t,
        lateral: -side * centerY,
        yaw: Math.atan2(dy, dx),
      };
    }
    distance -= length;
  }
  // 浮点误差导致的落空：退回起点。
  return { forward: profile[0][0], up: profile[0][1], lateral: -side * centerY, yaw: 0 };
}

/** 整侧履带节的位姿数组，供渲染层一次更新完。 */
export function treadLinkPoses(profile, offset, opts = {}) {
  const linksPerSide = opts.linksPerSide ?? TRACKS.linksPerSide;
  const out = [];
  for (let index = 0; index < linksPerSide; index += 1) {
    out.push(treadLinkPose(profile, offset, { ...opts, index }));
  }
  return out;
}

/** 云台俯仰限位（rad）。 */
export function clampTilt(tiltRad) {
  const t = Number.isFinite(tiltRad) ? tiltRad : 0;
  return clamp(t, -TILT_LIMIT_RAD, TILT_LIMIT_RAD);
}

/**
 * 位姿 → 渲染坐标。场景里机器人站在 y=0，朝向 yaw 绕 Y 轴。
 * 与 `scene-transform.js` 的 simToRender 同源，单独列出便于运动学测试不依赖场景模块。
 */
export function poseToRender(pose) {
  const yaw = pose?.yaw ?? 0;
  return {
    position: [pose?.xy?.[0] ?? 0, 0, -(pose?.xy?.[1] ?? 0)],
    yawDeg: (yaw * 180) / Math.PI,
    tiltDeg: (-clampTilt(((pose?.tilt_deg ?? 0) * Math.PI) / 180) * 180) / Math.PI,
  };
}
