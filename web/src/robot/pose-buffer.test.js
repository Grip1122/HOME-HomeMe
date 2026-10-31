import test from 'node:test';
import assert from 'node:assert/strict';

import { PoseBuffer } from './pose-buffer.js';

const pose = (sequence, serverTime, x, yaw = 0, epoch = 'a') => ({
  sequence,
  server_time: serverTime,
  xy: [x, 0],
  yaw,
  height: 1 + x / 10,
  tilt_deg: x,
  epoch,
  scene: 'restaurant',
});

test('两帧之间线性插值位置、杆高、俯仰', () => {
  const buffer = new PoseBuffer({ delay: 100, now: () => 0 });
  buffer.push(pose(1, 1, 0), 1100);
  buffer.push(pose(2, 1.1, 1), 1200);
  const middle = buffer.sample(1250);
  assert.ok(Math.abs(middle.xy[0] - 0.5) < 1e-9);
  assert.ok(Math.abs(middle.height - 1.05) < 1e-9);
  assert.ok(Math.abs(middle.tilt_deg - 0.5) < 1e-9);
});

test('边界：重复序号与乱序包一律丢弃', () => {
  const buffer = new PoseBuffer({ delay: 100, now: () => 0 });
  buffer.push(pose(2, 1, 0), 1100);
  assert.equal(buffer.push(pose(1, 1, 99), 1300), false);
  assert.equal(buffer.push(pose(2, 1.1, 5), 1400), false);
  assert.equal(buffer.push({ sequence: 3, server_time: 1.2 }, 1500), false, '缺 xy 应丢弃');
});

test('断流：只保持最后位姿，绝不外推', () => {
  const buffer = new PoseBuffer({ delay: 100, now: () => 0 });
  buffer.push(pose(1, 1, 0), 1100);
  buffer.push(pose(2, 1.1, 1), 1200);
  const late = buffer.sample(5000);
  assert.equal(late.xy[0], 1);
  assert.equal(late.yaw, 0);
});

test('跨 ±π 按最短方向转，不会反向绕一圈', () => {
  const buffer = new PoseBuffer({ delay: 100, now: () => 0 });
  buffer.push(pose(1, 1, 0, (179 * Math.PI) / 180), 1100);
  buffer.push(pose(2, 1.1, 0, (-179 * Math.PI) / 180), 1200);
  const mid = buffer.sample(1250);
  assert.ok(Math.abs(Math.abs(mid.yaw) - Math.PI) < 1e-9);
});

test('切换场景 / 重置：清空历史并接受新时间线', () => {
  const buffer = new PoseBuffer({ delay: 100, now: () => 0 });
  buffer.push(pose(1, 1, 0), 1100);
  buffer.push(pose(2, 1.1, 1), 1200);
  buffer.push(pose(3, 1.2, 20, 0, 'reset'), 1300);
  assert.equal(buffer.sample(1300).xy[0], 20);
  assert.equal(buffer.samples.length, 1);
});

test('未收到任何包时返回 null，调用方保持上一帧', () => {
  const buffer = new PoseBuffer({ delay: 100, now: () => 0 });
  assert.equal(buffer.sample(1000), null);
  buffer.reset();
  assert.equal(buffer.sample(), null);
});

test('包间隔变长时自动加大缓冲，避免追帧抖动', () => {
  const buffer = new PoseBuffer({ delay: 100, now: () => 0 });
  let t = 1000;
  for (let i = 1; i <= 12; i += 1) {
    buffer.push(pose(i, i * 0.1, i * 0.1), t);
    t += 200; // 5 Hz，明显慢于 20 Hz
  }
  assert.ok(buffer.gap > 150, `gap 应随包间隔变大，实际 ${buffer.gap}`);
});

test('超过 90 个采样后丢弃最旧的，内存不无限增长', () => {
  const buffer = new PoseBuffer({ delay: 100, now: () => 0 });
  for (let i = 1; i <= 120; i += 1) buffer.push(pose(i, i * 0.02, i * 0.01), 1000 + i * 20);
  assert.equal(buffer.samples.length, 90);
});
