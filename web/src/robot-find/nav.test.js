import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./nav.js", import.meta.url), "utf8");

function createGrid(opts = {}) {
  const sandbox = { window: { RF: {} } };
  runInNewContext(source, sandbox, { filename: "robot-find/nav.js" });
  return new sandbox.window.RF.NavGrid({
    minX: 0,
    maxX: 7,
    minZ: 0,
    maxZ: 7,
    cell: 1,
    ...opts,
  });
}

function touchesBlockedCell(a, b, grid, ix, iz) {
  const minX = grid.minX + ix * grid.cell;
  const minZ = grid.minZ + iz * grid.cell;
  let enter = 0;
  let leave = 1;
  for (const [start, end, min, max] of [
    [a.x, b.x, minX, Math.min(minX + grid.cell, grid.maxX)],
    [a.z, b.z, minZ, Math.min(minZ + grid.cell, grid.maxZ)],
  ]) {
    const delta = end - start;
    if (delta === 0) {
      if (start < min || start > max) return false;
    } else {
      const t1 = (min - start) / delta;
      const t2 = (max - start) / delta;
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
      if (enter - leave > 1e-12) return false;
    }
  }
  return true;
}

function expectSafePath(grid, path) {
  expect(Array.isArray(path)).toBe(true);
  expect(path.length).toBeGreaterThan(0);
  for (const point of path) {
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.z)).toBe(true);
    expect(point.x).toBeGreaterThanOrEqual(grid.minX);
    expect(point.x).toBeLessThan(grid.maxX);
    expect(point.z).toBeGreaterThanOrEqual(grid.minZ);
    expect(point.z).toBeLessThan(grid.maxZ);
    expect(grid.isBlockedWorld(point.x, point.z)).toBe(false);
  }
  for (let i = 1; i < path.length; i++) {
    for (let iz = 0; iz < grid.rows; iz++) {
      for (let ix = 0; ix < grid.cols; ix++) {
        if (!grid.isBlockedCell(ix, iz)) continue;
        expect(touchesBlockedCell(path[i - 1], path[i], grid, ix, iz)).toBe(false);
      }
    }
  }
}

describe("robot-find 导航（独立 window.RF 沙箱）", () => {
  it("开放区域保留直线平滑，不输出逐格折线", () => {
    const grid = createGrid();
    const path = grid.findPath({ x: 0.1, z: 0.1 }, { x: 6.9, z: 6.9 });
    expect(path).toEqual([{ x: 0.5, z: 0.5 }, { x: 6.5, z: 6.5 }]);
    expectSafePath(grid, path);
  });

  it("正常绕过障碍，所有平滑线段均不穿墙", () => {
    const grid = createGrid();
    for (let iz = 1; iz <= 5; iz++) grid.blocked[grid.idx(3, iz)] = 1;
    const start = { x: 0.5, z: 3.5 };
    const goal = { x: 6.5, z: 3.5 };
    const path = grid.findPath(start, goal);
    expect(path.length).toBeGreaterThan(2);
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(goal);
    expectSafePath(grid, path);
  });

  it("保留负世界坐标、障碍膨胀和 bake 后的可达路径平滑", () => {
    const grid = createGrid({ minX: -4, maxX: 4, minZ: -4, maxZ: 4, cell: 0.4 });
    grid.addObstacleBox({ minX: -0.6, maxX: 0.6, minZ: -1.2, maxZ: 1.2 }, 0.2);
    grid.bake();
    const start = { x: -2.8, z: 0 };
    const goal = { x: 2.8, z: 0 };
    const path = grid.findPath(start, goal);
    expect(path.length).toBeGreaterThan(2);
    expect(path.length).toBeLessThanOrEqual(6);
    expect(path[0]).toEqual(grid.nearestFreeWorld(start.x, start.z));
    expect(path[path.length - 1]).toEqual(grid.nearestFreeWorld(goal.x, goal.z));
    expect(path.some((point, i) => i > 0 && Math.hypot(
      point.x - path[i - 1].x,
      point.z - path[i - 1].z,
    ) > grid.cell * Math.SQRT2)).toBe(true);
    expectSafePath(grid, path);
  });

  it.each([[1, 0], [0, 1], [2, 1], [1, 2]])("平滑不擦过障碍格 (%i, %i) 的角", (ix, iz) => {
    const grid = createGrid();
    grid.blocked[grid.idx(ix, iz)] = 1;
    const start = { x: 0.5, z: 0.5 };
    const goal = { x: 3.5, z: 3.5 };
    expect(grid.lineClear(start.x, start.z, goal.x, goal.z)).toBe(false);
    expect(grid.lineClear(goal.x, goal.z, start.x, start.z)).toBe(false);
    const path = grid.findPath(start, goal);
    expect(path.length).toBeGreaterThan(2);
    expectSafePath(grid, path);
  });

  it("非 45 度线段也不能穿过障碍角", () => {
    const grid = createGrid();
    grid.blocked[grid.idx(2, 1)] = 1;
    expect(grid.lineClear(0.5, 0.5, 5.5, 1.5)).toBe(false);
    expect(grid.lineClear(5.5, 1.5, 0.5, 0.5)).toBe(false);
    expectSafePath(grid, grid.findPath({ x: 0.5, z: 0.5 }, { x: 5.5, z: 1.5 }));
  });

  it("合法的斜线、水平线、垂直线和零长度线段仍可通过", () => {
    const grid = createGrid();
    grid.blocked[grid.idx(1, 0)] = 1;
    expect(grid.lineClear(0.5, 0.5, 2.5, 3.5)).toBe(true);
    expect(grid.lineClear(2.5, 3.5, 0.5, 0.5)).toBe(true);
    expect(grid.lineClear(0.5, 2.5, 6.5, 2.5)).toBe(true);
    expect(grid.lineClear(0.5, 0.5, 0.5, 6.5)).toBe(true);
    expect(grid.lineClear(0.5, 0.5, 0.5, 0.5)).toBe(true);
  });

  it("终点位于格线上时不越过目标格，双向检测一致", () => {
    const grid = createGrid({ maxX: 4, maxZ: 4 });
    expect(grid.lineClear(2.5, 0.5, 1, 2)).toBe(true);
    expect(grid.lineClear(1, 2, 2.5, 0.5)).toBe(true);
    expect(grid.lineClear(0, 0, 3, 3)).toBe(true);
    expect(grid.lineClear(3, 3, 0, 0)).toBe(true);
  });

  it("仅剩对角相邻空格时不能穿角到达", () => {
    const grid = createGrid({ maxX: 2, maxZ: 2 });
    grid.blocked[grid.idx(1, 0)] = 1;
    grid.blocked[grid.idx(0, 1)] = 1;
    expect(grid.findPath({ x: 0.5, z: 0.5 }, { x: 1.5, z: 1.5 })).toBeNull();
  });

  it("不可达返回 null，不能伪造起终点直连或空路径", () => {
    const grid = createGrid();
    for (let iz = 0; iz < grid.rows; iz++) grid.blocked[grid.idx(3, iz)] = 1;
    expect(grid.findPath({ x: 0.5, z: 3.5 }, { x: 6.5, z: 3.5 })).toBeNull();
  });

  it("全堵时最近空点和路径均返回 null，包括起终点相同", () => {
    const grid = createGrid();
    grid.blocked.fill(1);
    const point = { x: 3.5, z: 3.5 };
    expect(grid.nearestFreeWorld(point.x, point.z)).toBeNull();
    expect(grid.findPath(point, { x: 5.5, z: 5.5 })).toBeNull();
    expect(grid.findPath(point, point)).toBeNull();
  });

  it("搜索环内无合法点返回 null，不回退到障碍里的原坐标", () => {
    const grid = createGrid();
    grid.blocked.fill(1);
    grid.blocked[grid.idx(6, 6)] = 0;
    expect(grid.nearestFreeWorld(0.5, 0.5, 2)).toBeNull();
    expect(grid.nearestFreeWorld(0.5, 0.5, 0)).toBeNull();
    expect(grid.nearestFreeWorld(0.5, 0.5, 6)).toEqual({ x: 6.5, z: 6.5 });
  });

  it("障碍上的端点仍可吸附到附近合法格", () => {
    const grid = createGrid();
    grid.blocked[grid.idx(3, 3)] = 1;
    expect(grid.nearestFreeWorld(3.1, 3.5)).toEqual({ x: 2.5, z: 3.5 });
    const path = grid.findPath({ x: 3.1, z: 3.5 }, { x: 0.5, z: 3.5 });
    expect(path[0]).toEqual({ x: 2.5, z: 3.5 });
    expectSafePath(grid, path);
  });

  it("同点或同格返回单个合法点，长度为零，与失败 null 区分", () => {
    const grid = createGrid();
    const point = { x: 2.25, z: 3.75 };
    const path = grid.findPath(point, point);
    expect(path).toEqual([{ x: 2.5, z: 3.5 }]);
    expect(grid.pathLength(path)).toBe(0);
    expect(grid.findPath(point, { x: 2.9, z: 3.1 })).toEqual(path);
    expect(grid.pathLength([])).toBe(0);
    expectSafePath(grid, path);
  });

  it.each([
    undefined,
    null,
    {},
    { x: 1 },
    { z: 1 },
    { x: "1", z: 1 },
    { x: 1, z: "1" },
    { x: null, z: 1 },
    { x: NaN, z: 1 },
    { x: 1, z: NaN },
    { x: Infinity, z: 1 },
    { x: -Infinity, z: 1 },
    { x: 1, z: Infinity },
    { x: 1, z: -Infinity },
  ])("非法或缺失的任一端点返回 null：%j", (point) => {
    const grid = createGrid();
    const valid = { x: 3.5, z: 3.5 };
    expect(grid.findPath(point, valid)).toBeNull();
    expect(grid.findPath(valid, point)).toBeNull();
    expect(grid.findPath(point, point)).toBeNull();
  });

  it.each([
    [undefined, 1],
    [1, undefined],
    ["1", 1],
    [1, null],
    [NaN, 1],
    [1, NaN],
    [Infinity, 1],
    [-Infinity, 1],
    [1, Infinity],
    [1, -Infinity],
  ])("非法世界坐标 (%s, %s) 不得视作空地或可见线段", (x, z) => {
    const grid = createGrid();
    expect(grid.nearestFreeWorld(x, z)).toBeNull();
    expect(grid.isBlockedWorld(x, z)).toBe(true);
    expect(grid.lineClear(x, z, 3.5, 3.5)).toBe(false);
    expect(grid.lineClear(3.5, 3.5, x, z)).toBe(false);
  });

  it.each([NaN, Infinity, -Infinity, -1])("非法搜索半径 %s 返回 null", (maxRing) => {
    const grid = createGrid();
    grid.blocked.fill(1);
    expect(grid.nearestFreeWorld(3.5, 3.5, maxRing)).toBeNull();
  });

  it("世界下界可用，上界内侧可用，路径点始终位于世界内", () => {
    const grid = createGrid({ minX: -2, maxX: 2, minZ: -3, maxZ: 3 });
    expect(grid.worldToCell(-2, -3)).toEqual({ ix: 0, iz: 0 });
    expect(grid.isBlockedWorld(-2, -3)).toBe(false);
    const path = grid.findPath({ x: -2, z: -3 }, { x: 2 - 1e-8, z: 3 - 1e-8 });
    expect(path).toEqual([{ x: -1.5, z: -2.5 }, { x: 1.5, z: 2.5 }]);
    expectSafePath(grid, path);
  });

  it.each([
    [-2.01, 0],
    [2, 0],
    [2.01, 0],
    [0, -3.01],
    [0, 3],
    [0, 3.01],
    [Number.MAX_VALUE, 0],
    [-Number.MAX_VALUE, 0],
  ])("越界世界坐标 (%s, %s) 返回 null，不生成越界路径", (x, z) => {
    const grid = createGrid({ minX: -2, maxX: 2, minZ: -3, maxZ: 3 });
    const outside = { x, z };
    const inside = { x: 0.5, z: 0.5 };
    expect(grid.isBlockedWorld(x, z)).toBe(true);
    expect(grid.nearestFreeWorld(x, z)).toBeNull();
    expect(grid.findPath(outside, inside)).toBeNull();
    expect(grid.findPath(inside, outside)).toBeNull();
    expect(grid.lineClear(x, z, inside.x, inside.z)).toBe(false);
  });

  it("不能把不足一格的世界边缘吸附到界外", () => {
    const grid = createGrid({ maxX: 2.2, maxZ: 1.2 });
    const path = grid.findPath({ x: 0.1, z: 0.1 }, { x: 2.19, z: 1.19 });
    expect(path[path.length - 1].x).toBeCloseTo(2.1);
    expect(path[path.length - 1].z).toBeCloseTo(1.1);
    expectSafePath(grid, path);
    expect(grid.nearestFreeWorld(2.2, 0.5)).toBeNull();
    expect(grid.nearestFreeWorld(0.5, 1.2)).toBeNull();
    expect(grid.isBlockedWorld(2.21, 0.5)).toBe(true);
    expect(grid.isBlockedWorld(0.5, 1.21)).toBe(true);
  });

  it.each([[-1, 0], [7, 0], [0, 7], [0.5, 0], [0, 0.5], [NaN, 0], [0, Infinity]])(
    "非法格索引 (%s, %s) 不得视作合法空格",
    (ix, iz) => {
      const grid = createGrid();
      expect(grid.inBounds(ix, iz)).toBe(false);
      expect(grid.isBlockedCell(ix, iz)).toBe(true);
    },
  );
});
