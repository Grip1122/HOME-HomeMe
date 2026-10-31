import { describe, it, expect } from 'vitest';
import { createCube, stepRotation } from './spinning_cube.js';

describe('spinning_cube', () => {
  it('转动 1 秒后 y 轴转过 1 弧度、x 轴转过 0.7 弧度', () => {
    const cube = createCube();
    stepRotation(cube, 1);
    expect(cube.rotation.y).toBeCloseTo(1, 10);
    expect(cube.rotation.x).toBeCloseTo(0.7, 10);
  });

  it('dt 为 0 时姿态保持不变', () => {
    const cube = createCube();
    stepRotation(cube, 0);
    expect(cube.rotation.x).toBe(0);
    expect(cube.rotation.y).toBe(0);
  });

  it('dt 为负数、NaN、Infinity 时抛错且姿态不被改动', () => {
    const cube = createCube();
    for (const bad of [-0.1, NaN, Infinity]) {
      expect(() => stepRotation(cube, bad)).toThrow(RangeError);
    }
    expect(cube.rotation.y).toBe(0);
  });

  it('size 非正或非有限时拒绝创建', () => {
    for (const bad of [0, -1, NaN, Infinity]) {
      expect(() => createCube(bad)).toThrow(RangeError);
    }
  });
});
