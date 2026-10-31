import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DEFAULT_GROUND_OFFSET,
  calibrateScale,
  insideGrid,
  rawToSim,
  renderToSim,
  roiToSimBounds,
  simToRaw,
  simToRender,
} from './scene-transform.js';

const layout = JSON.parse(readFileSync(new URL('../../public/layouts/layout_A.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(
  readFileSync(new URL('../../../assets/gaussian-splat/manifest.json', import.meta.url), 'utf8'),
);

const near = (a, b, eps = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) < eps);

test('原始 → 仿真 → 原始 往返一致', () => {
  const raw = [3.42, 0.78, -1.66];
  const sim = rawToSim(raw);
  assert.ok(near(sim, [3.42, -1.66, -0.78 + DEFAULT_GROUND_OFFSET]));
  assert.ok(near(simToRaw(sim), raw));
});

test('地面偏移：y=groundOffset 的原始地面点落到仿真 y=0', () => {
  const sim = rawToSim([0, DEFAULT_GROUND_OFFSET, 0]);
  assert.ok(Math.abs(sim[2]) < 1e-12);
});

test('渲染坐标只翻 z，不动高度', () => {
  assert.deepEqual(simToRender([2, 3]), [2, -3]);
  assert.deepEqual(renderToSim([2, -3]), [2, 3]);
  assert.deepEqual(renderToSim(simToRender([1.5, -2.5])), [1.5, -2.5]);
  assert.deepEqual(simToRender(renderToSim([-4, 7])), [-4, 7]);
});

test('标定：门宽 0.9 m 对应 1.8 个场景单位 → 0.5', () => {
  const { scale, calibrated } = calibrateScale(1.8, 0.9);
  assert.equal(calibrated, true);
  assert.ok(Math.abs(scale - 0.5) < 1e-12);
});

test('异常：零或负的标定量直接拒绝，不允许静默返回 1', () => {
  assert.throws(() => calibrateScale(0, 0.9), RangeError);
  assert.throws(() => calibrateScale(1.8, 0), RangeError);
  assert.throws(() => calibrateScale(-1.8, 0.9), RangeError);
  assert.throws(() => calibrateScale(NaN, 0.9), RangeError);
});

test('ROI 换算：轴翻转后 min/max 仍然有序', () => {
  const entry = manifest.assets.find((a) => a.id === 'scene_main');
  const bounds = roiToSimBounds(entry.roi_p1_p99);
  assert.ok(bounds.min.every((v, i) => v <= bounds.max[i] + 1e-12));
  assert.ok(bounds.extent.every((v) => v > 0));
});

test('异常：缺 min/max 的 ROI 抛 TypeError', () => {
  assert.throws(() => roiToSimBounds(null), TypeError);
  assert.throws(() => roiToSimBounds({ min: [0, 0, 0] }), TypeError);
});

test('网格内判定与 layout 边界一致', () => {
  const g = layout.grid;
  assert.equal(insideGrid(layout, g.origin[0], g.origin[2]), true);
  assert.equal(insideGrid(layout, g.origin[0] - 0.01, g.origin[2]), false);
  assert.equal(insideGrid(layout, g.origin[0] + g.cols * g.cell + 0.01, g.origin[2]), false);
});
