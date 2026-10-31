import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  blockedCells,
  cellCenter,
  doorOpen,
  key,
  nearestPassable,
  reachableCells,
  roomOfCell,
  toList,
  unkey,
  worldToCell,
} from './grid.js';

const layout = JSON.parse(readFileSync(new URL('../../public/layouts/layout_A.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/layout_A.nav.json', import.meta.url), 'utf8'));

test('阻挡格与后端 layoutlib 逐格一致', () => {
  const js = toList(blockedCells(layout));
  assert.equal(js.length, fixture.blocked.length, `阻挡格数量不一致：JS ${js.length} / 参照 ${fixture.blocked.length}`);
  assert.deepEqual(js, fixture.blocked);
});

test('三个分区的可达集与后端一致（扫描点为起点）', () => {
  for (const room of layout.rooms) {
    const [c, r] = worldToCell(layout, room.scan_point[0], room.scan_point[2]);
    assert.equal(roomOfCell(layout, c, r), room.id, `扫描点 ${room.id} 不在本分区`);
    const js = toList(reachableCells(layout, [c, r]));
    assert.deepEqual(js, fixture.reachable[room.id], `分区 ${room.id} 可达集不一致`);
    assert.ok(js.length > 0, `分区 ${room.id} 可达集为空`);
  }
});

test('跨分区相邻格：只有门洞窗口内才连通', () => {
  const blocked = blockedCells(layout);
  const probes = [];
  for (let c = 0; c < layout.grid.cols - 1; c += 1) {
    for (let r = 0; r < layout.grid.rows; r += 1) {
      const a = [c, r];
      const b = [c + 1, r];
      if (roomOfCell(layout, c, r) === roomOfCell(layout, c + 1, r)) continue;
      probes.push({ a, b, open: doorOpen(layout, a, b) });
    }
  }
  assert.deepEqual(probes, fixture.boundary_probes);
  const openCount = probes.filter((p) => p.open).length;
  assert.equal(openCount, 6, '两扇 1.5 m 门洞在 0.5 m 网格上应各开 3 行');
});

test('边界：起点落在阻挡格返回空集', () => {
  const blocked = blockedCells(layout);
  assert.ok(blocked.size > 0, '参照快照里应当存在阻挡格');
  const blockedCell = unkey([...blocked][0]);
  assert.equal(reachableCells(layout, blockedCell, blocked).size, 0);
});

test('异常：起点越界返回空集，不抛异常', () => {
  assert.equal(reachableCells(layout, [-1, 0]).size, 0);
  assert.equal(reachableCells(layout, [layout.grid.cols, 0]).size, 0);
  assert.equal(reachableCells(layout, [0, layout.grid.rows + 5]).size, 0);
});

test('格心世界坐标与 worldToCell 互逆', () => {
  for (const [c, r] of [[0, 0], [11, 17], [23, 0], [12, 9]]) {
    const [x, z] = cellCenter(layout, c, r);
    assert.deepEqual(worldToCell(layout, x, z), [c, r]);
  }
});

test('目标落在阻挡格时落到最近可通行格', () => {
  const blocked = blockedCells(layout);
  const table = layout.furniture.find((f) => f.id === 'table_coffee');
  const inside = worldToCell(layout, table.pos[0] + table.size[0] / 2, table.pos[2] + table.size[2] / 2);
  assert.ok(blocked.has(key(inside[0], inside[1])), '茶几中心应当是阻挡格');
  const landing = nearestPassable(layout, inside, blocked);
  assert.ok(landing, '应当找得到最近可通行格');
  assert.ok(!blocked.has(key(landing[0], landing[1])));
});
