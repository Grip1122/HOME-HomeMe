import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { astar, findPath, lineCells, lineOfSight, smoothPath } from './astar.js';
import { blockedCells, cellCenter, doorOpen, key, roomOfCell, worldToCell } from './grid.js';

const layout = JSON.parse(readFileSync(new URL('../../public/layouts/layout_A.json', import.meta.url), 'utf8'));
const blocked = blockedCells(layout);

const at = (room, index = 0) => {
  const r = layout.rooms.find((x) => x.id === room);
  return worldToCell(layout, r.scan_point[0], r.scan_point[2] + index * 0);
};

test('起点终点相同返回单格路径、代价 0', () => {
  const start = at('living');
  const result = astar(layout, start, start, blocked);
  assert.ok(result);
  assert.deepEqual(result.cells, [start]);
  assert.equal(result.cost, 0);
});

test('客厅 → 书房跨门洞可达，且首尾正确', () => {
  const result = astar(layout, at('living'), at('study'), blocked);
  assert.ok(result, '客厅到书房必须可达（门洞 1.5 m）');
  assert.deepEqual(result.cells[0], at('living'));
  assert.deepEqual(result.cells.at(-1), at('study'));
  assert.ok(result.cost > 0);
});

test('路径每一步都合法：不穿墙、不踩家具、斜走不穿角', () => {
  const result = astar(layout, at('living'), at('study'), blocked);
  for (let i = 1; i < result.cells.length; i += 1) {
    const a = result.cells[i - 1];
    const b = result.cells[i];
    assert.ok(!blocked.has(key(b[0], b[1])), `第 ${i} 步踩进阻挡格 ${b}`);
    assert.ok(Math.abs(b[0] - a[0]) <= 1 && Math.abs(b[1] - a[1]) <= 1, `第 ${i} 步跳格`);
    assert.ok(doorOpen(layout, a, b), `第 ${i} 步跨分区未经过门洞：${a} → ${b}`);
    if (a[0] !== b[0] && a[1] !== b[1]) {
      assert.ok(!blocked.has(key(b[0], a[1])) && !blocked.has(key(a[0], b[1])), `第 ${i} 步穿角`);
    }
  }
});

test('拉直后仍然不穿墙：每段都通过超覆盖视线检查', () => {
  const result = astar(layout, at('living'), at('study'), blocked);
  const smoothed = smoothPath(layout, result.cells, blocked);
  assert.ok(smoothed.length <= result.cells.length);
  assert.deepEqual(smoothed[0], result.cells[0]);
  assert.deepEqual(smoothed.at(-1), result.cells.at(-1));
  for (let i = 1; i < smoothed.length; i += 1) {
    assert.ok(lineOfSight(layout, smoothed[i - 1], smoothed[i], blocked), `第 ${i} 段视线被挡`);
  }
});

test('超覆盖遍历不会漏掉门框角点', () => {
  // 沿分区边界竖着画一条线：必须同时命中左右两列（而不是只命中起点终点）。
  const cells = lineCells([11, 0], [11, 17]);
  assert.equal(cells.length, 18);
  const diagonal = lineCells([0, 0], [3, 3]);
  assert.ok(diagonal.some(([c, r]) => c !== r), '对角超覆盖应包含贴角格');
});

test('目标落在阻挡格：findPath 落到最近可通行格并返回 goal', () => {
  const table = layout.furniture.find((f) => f.id === 'table_dining');
  const inside = worldToCell(layout, table.pos[0] + table.size[0] / 2, table.pos[2] + table.size[2] / 2);
  assert.ok(blocked.has(key(inside[0], inside[1])));
  const result = findPath(layout, { from: at('living'), to: inside, blocked });
  assert.ok(result, '家具内部作为目标时应当落到旁边');
  assert.ok(!blocked.has(key(result.goal[0], result.goal[1])));
});

test('异常：目标被完全封死时返回 null，不抛异常', () => {
  const walled = new Set();
  for (let c = 0; c < layout.grid.cols; c += 1) {
    for (let r = 0; r < layout.grid.rows; r += 1) {
      if (c !== 5 || r !== 5) walled.add(key(c, r));
    }
  }
  assert.equal(astar(layout, [5, 5], [10, 10], walled), null);
});

test('异常：起点越界返回 null', () => {
  assert.equal(astar(layout, [-1, 3], at('study'), blocked), null);
  assert.equal(astar(layout, [0, 999], at('study'), blocked), null);
});

test('格心对齐：路径点换算回世界坐标落在网格内', () => {
  const [x, z] = cellCenter(layout, ...at('bedroom'));
  const g = layout.grid;
  assert.ok(x > g.origin[0] && x < g.origin[0] + g.cols * g.cell);
  assert.ok(z > g.origin[2] && z < g.origin[2] + g.rows * g.cell);
  assert.equal(roomOfCell(layout, ...at('bedroom')), 'bedroom');
});
