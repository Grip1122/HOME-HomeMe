import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MAST,
  TILT_LIMIT_RAD,
  TRACKS,
  clampTilt,
  mastStageOffsets,
  poseToRender,
  profilePerimeter,
  treadLinkPose,
  treadLinkPoses,
  treadTravel,
} from './kinematics.js';

const robot = JSON.parse(readFileSync(new URL('../../../assets/robot/manifest.json', import.meta.url), 'utf8'));

test('四节杆：0.55 m 全收，2.30 m 全伸，合计高度等于目标高度', () => {
  const low = mastStageOffsets(0.55);
  assert.equal(low.extension, 0);
  assert.deepEqual(low.localY, [0.55, 0, 0, 0]);

  const high = mastStageOffsets(2.3);
  assert.ok(Math.abs(high.extension - 0.4375) < 1e-9);
  assert.ok(Math.abs(0.55 + 4 * high.extension - 2.3) < 1e-9);

  const mid = mastStageOffsets(1.15);
  assert.ok(Math.abs(0.55 + 4 * mid.extension - 1.15) < 1e-9);
  assert.ok(Math.abs(mid.localY[0] - (0.55 + mid.extension)) < 1e-9);
  assert.ok(mid.localY.slice(1).every((y) => Math.abs(y - mid.extension) < 1e-9));
});

test('边界：超限杆高被夹紧并标记，非法值退回最低位', () => {
  assert.equal(mastStageOffsets(9).height, MAST.maxHeight);
  assert.equal(mastStageOffsets(9).clampApplied, true);
  assert.equal(mastStageOffsets(0.1).height, MAST.minHeight);
  assert.equal(mastStageOffsets(NaN).height, MAST.minHeight);
});

test('直行：左右履带同向同速', () => {
  const t = treadTravel({ xy: [0, 0], yaw: 0 }, { xy: [0.2, 0], yaw: 0 });
  assert.equal(t.accepted, true);
  assert.ok(Math.abs(t.leftTravel - 0.2) < 1e-12);
  assert.ok(Math.abs(t.rightTravel - 0.2) < 1e-12);
  assert.ok(Math.abs(t.leftAngle - t.rightAngle) < 1e-12);
});

test('原地左转：左右履带反向（差速）', () => {
  const t = treadTravel({ xy: [0, 0], yaw: 0 }, { xy: [0, 0], yaw: 0.5 });
  assert.equal(t.accepted, true);
  assert.ok(Math.abs(t.leftTravel + TRACKS.centerY * 0.5) < 1e-12);
  assert.ok(Math.abs(t.rightTravel - TRACKS.centerY * 0.5) < 1e-12);
  assert.ok(t.leftAngle < 0 && t.rightAngle > 0);
});

test('异常：瞬移（>0.4 m）不累计履带行程', () => {
  const t = treadTravel({ xy: [0, 0], yaw: 0 }, { xy: [3, 0], yaw: 0 });
  assert.equal(t.accepted, false);
  assert.equal(t.leftTravel, 0);
  assert.equal(t.rightTravel, 0);
});

test('异常：大幅度转身（>0.6 rad）同样丢弃，避免履带突跳', () => {
  assert.equal(treadTravel({ xy: [0, 0], yaw: 0 }, { xy: [0, 0], yaw: 1.2 }).accepted, false);
  assert.equal(treadTravel(null, { xy: [0, 0], yaw: 0 }).accepted, false);
});

test('履带行程绕 ±π 取最短角，不会整圈回退', () => {
  const t = treadTravel(
    { xy: [0, 0], yaw: (179 * Math.PI) / 180 },
    { xy: [0, 0], yaw: (-179 * Math.PI) / 180 },
  );
  assert.equal(t.accepted, true);
  assert.ok(Math.abs(Math.abs(t.turn) - (2 * Math.PI) / 180) < 1e-9);
});

test('轮廓周长与清单一致（84 块履带节、每侧 42 块）', () => {
  const perimeter = profilePerimeter(robot.tracks.profile);
  assert.ok(perimeter > 0.9 && perimeter < 1.1, `周长应在 1 m 量级，实际 ${perimeter}`);
  assert.equal(robot.tracks.links_per_side, TRACKS.linksPerSide);
  const poses = treadLinkPoses(robot.tracks.profile, 0.3);
  assert.equal(poses.length, 42);
  assert.ok(poses.every((p) => p && Number.isFinite(p.forward) && Number.isFinite(p.up)));
});

test('履带节位置随行程前移、按周长回绕', () => {
  const profile = robot.tracks.profile;
  const perimeter = profilePerimeter(profile);
  const a = treadLinkPose(profile, 0.05, { index: 0 });
  const b = treadLinkPose(profile, 0.1, { index: 0 });
  assert.notDeepEqual(a, b);
  const wrapped = treadLinkPose(profile, perimeter + 0.05, { index: 0 });
  assert.ok(Math.abs(wrapped.forward - a.forward) < 1e-9);
  assert.ok(Math.abs(wrapped.up - a.up) < 1e-9);
  const negative = treadLinkPose(profile, -0.05, { index: 0 });
  assert.ok(negative && Number.isFinite(negative.forward));
});

test('异常：空轮廓返回 null，不抛异常', () => {
  assert.equal(profilePerimeter([]), 0);
  assert.equal(treadLinkPose([], 1, { index: 0 }), null);
  assert.equal(treadLinkPose([[0, 0]], 1, { index: 0 }), null);
});

test('云台俯仰限位：±0.65 rad，非法值归零', () => {
  assert.equal(clampTilt(1.4), TILT_LIMIT_RAD);
  assert.equal(clampTilt(-1.4), -TILT_LIMIT_RAD);
  assert.equal(clampTilt(NaN), 0);
});

test('位姿映射到渲染坐标：z 取反、度数换算', () => {
  const r = poseToRender({ xy: [2, 3], yaw: Math.PI / 2, tilt_deg: 30 });
  assert.deepEqual(r.position, [2, 0, -3]);
  assert.ok(Math.abs(r.yawDeg - 90) < 1e-9);
  assert.ok(Math.abs(r.tiltDeg + 30) < 1e-9);
  assert.deepEqual(poseToRender(null).position.map((v) => v + 0), [0, 0, 0]);
});
