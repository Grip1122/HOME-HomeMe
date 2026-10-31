import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildGrid, blockedCells, doorOpen, reachableCells, worldToCell, nearestWalkable,
  findPath, stepOk, cellCenter, furnitureBox, astar, roomOfCell,
} from './grid.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutFile = path.resolve(here, '../../public/layouts/layout_A.json');
const layout = JSON.parse(fs.readFileSync(layoutFile, 'utf-8'));
const ref = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/reference_layout_A.json'), 'utf-8'));
const grid = buildGrid(layout);
const k = (c, r) => `${c},${r}`;
const toSet = (pairs) => new Set(pairs.map(([c, r]) => k(c, r)));

describe('与后端 layoutlib.py 的对账', () => {
  it('参照数据对应当前布局（布局改了没重新生成就报错）', () => {
    const sha = crypto.createHash('sha256').update(fs.readFileSync(layoutFile)).digest('hex');
    expect(sha).toBe(ref.layout_sha256);
  });

  it('不可通行格集合与后端完全相同', () => {
    expect(blockedCells(layout)).toEqual(toSet(ref.blocked));
  });

  it('所有跨分区相邻格对的门洞放行结果与后端一致（放行的恰好是后端那些）', () => {
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const mine = [];
    for (let c = 0; c < layout.grid.cols; c++) {
      for (let r = 0; r < layout.grid.rows; r++) {
        for (const [dc, dr] of DIRS) {
          const b = [c + dc, r + dr];
          if (b[0] < 0 || b[0] >= layout.grid.cols || b[1] < 0 || b[1] >= layout.grid.rows) continue;
          const ra = layout.rooms.find((m) => c >= m.rect[0] && c < m.rect[0] + m.rect[2] && r >= m.rect[1] && r < m.rect[1] + m.rect[3]);
          const rb = layout.rooms.find((m) => b[0] >= m.rect[0] && b[0] < m.rect[0] + m.rect[2] && b[1] >= m.rect[1] && b[1] < m.rect[1] + m.rect[3]);
          if (ra && rb && ra.id !== rb.id && doorOpen(layout, [c, r], b)) mine.push([c, r, b[0], b[1]]);
        }
      }
    }
    const sortKey = (e) => e.join(',');
    expect(mine.map(sortKey).sort()).toEqual(ref.open_edges.map(sortKey).sort());
  });

  it('三个房间扫描点出发的可达格集合与后端相同', () => {
    for (const room of layout.rooms) {
      const [x, , z] = room.scan_point;
      const got = reachableCells(grid, worldToCell(layout, x, z));
      expect(got, room.id).toEqual(toSet(ref.reachable_from_scan_point[room.id]));
    }
  });

  it('世界坐标转格子（含负数边界）与后端一致', () => {
    for (const [x, z, c, r] of ref.world_to_cell) expect(worldToCell(layout, x, z), `${x},${z}`).toEqual([c, r]);
  });

  it('后端判定的"穿角"对角步，前端 stepOk 全部拒绝（且样本非空，防止空转）', () => {
    expect(ref.corner_forbidden.length).toBeGreaterThan(10);
    for (const [c, r, c2, r2] of ref.corner_forbidden) {
      expect(stepOk(grid, [c, r], [c2, r2]), `${c},${r}->${c2},${r2}`).toBe(false);
    }
  });

  it('8 件物体所在家具到最近可达格的距离与后端一致', () => {
    const reach = reachableCells(grid, worldToCell(layout, ...[layout.rooms[0].scan_point[0], layout.rooms[0].scan_point[2]]));
    for (const o of layout.objects) {
      const f = layout.furniture.find((m) => m.id === o.on);
      const n = nearestWalkable(grid, 0, 0, { reach, box: furnitureBox(f) });
      expect(n.dist, o.id).toBeCloseTo(ref.nearest[o.id].dist_to_furniture_box, 6);
    }
  });
});

describe('寻路（任务书三条验收用例）', () => {
  // 客厅与卧室的门：pos=(0,0,-2.25)、width=1.5、axis=z，即 x=0 处墙上 z∈[-3,-1.5] 的缺口。
  const door = layout.doors.find((d) => d.id === 'door_living_bedroom');
  const doorZ = door.pos[2];

  it('门洞内通：客厅到卧室的路径存在，且穿墙那一步落在门洞范围内', () => {
    const p = findPath(grid, [-3, doorZ], [3, doorZ]);
    expect(p).not.toBeNull();
    expect(p.points.length).toBeGreaterThan(0);
    // cells 含起点：起点在 x<0（客厅），终点在 x>0（卧室），说明路径确实穿过了墙
    const xs = p.cells.map((cell) => cellCenter(layout, ...cell)[0]);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(0);
    // 原始 A* 路径逐步合法，且每一次跨分区的步都落在门洞范围内
    const raw = astar(grid, worldToCell(layout, -3, doorZ), worldToCell(layout, 3, doorZ));
    expect(raw).not.toBeNull();
    let crossings = 0;
    for (let i = 1; i < raw.length; i++) {
      expect(stepOk(grid, raw[i - 1], raw[i]), `第${i}步`).toBe(true);
      if (roomOfCell(layout, ...raw[i - 1]) !== roomOfCell(layout, ...raw[i])) {
        crossings += 1;
        const [, mz] = [0, (cellCenter(layout, ...raw[i - 1])[1] + cellCenter(layout, ...raw[i])[1]) / 2];
        expect(Math.abs(mz - doorZ)).toBeLessThanOrEqual(door.width / 2 + 1e-9);
      }
    }
    expect(crossings).toBe(1);
  });

  it('门洞外不通：墙上非门洞处，相邻两格互不连通', () => {
    // 门洞 z∈[-3,-1.5]；z=+1.25 的墙段没有门，x=-0.25 与 x=+0.25 两格是否同属一个房间由 rect 决定
    const z = 1.25;
    const a = worldToCell(layout, -0.25, z);
    const b = worldToCell(layout, 0.25, z);
    expect(doorOpen(layout, a, b)).toBe(false);
    expect(stepOk(grid, a, b)).toBe(false);
    // 对照：门洞里的同样一步是通的
    const a2 = worldToCell(layout, -0.25, doorZ);
    const b2 = worldToCell(layout, 0.25, doorZ);
    expect(doorOpen(layout, a2, b2)).toBe(true);
  });

  it('终点落在家具内部：落到最近可通行格，snapped=true，且该格确实可走', () => {
    const sofa = layout.furniture.find((f) => f.id === 'sofa');
    const [x0, z0, x1, z1] = furnitureBox(sofa);
    const inside = [(x0 + x1) / 2, (z0 + z1) / 2];
    const p = findPath(grid, [-1.5, 0], inside);
    expect(p).not.toBeNull();
    expect(p.snapped).toBe(true);
    expect(grid.blocked.has(k(...p.goalCell))).toBe(false);
  });

  it('起点终点相同：返回空路径', () => {
    const p = findPath(grid, [-1.5, 0], [-1.5, 0]);
    expect(p.points).toEqual([]);
    expect(p.cells).toHaveLength(1);
  });

  it('同格内的小位移也算到达：返回空路径', () => {
    const p = findPath(grid, [-1.5, 0], [-1.4, 0.1]);
    expect(p.points).toEqual([]);
  });

  it('路径上每个点都不落在不可通行格内（不穿家具）', () => {
    const p = findPath(grid, [-3, doorZ], [3, 3]);
    expect(p).not.toBeNull();
    for (const [x, z] of p.points) {
      const [c, r] = worldToCell(layout, x, z);
      expect(grid.blocked.has(k(c, r)), `${x},${z}`).toBe(false);
    }
  });

  it('平滑后的相邻路径点之间沿线采样不穿过不可通行格', () => {
    const p = findPath(grid, [-5, 3.5], [5, -3.5]);
    expect(p).not.toBeNull();
    const pts = [[-5, 3.5], ...p.points];
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1];
      const [bx, bz] = pts[i];
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.05);
      for (let j = 0; j <= n; j++) {
        const [c, r] = worldToCell(layout, ax + ((bx - ax) * j) / n, az + ((bz - az) * j) / n);
        expect(grid.blocked.has(k(c, r)), `段${i} 采样${j}`).toBe(false);
      }
    }
  });

  it('cellCenter 与 worldToCell 互逆', () => {
    for (const [c, r] of [[0, 0], [5, 7], [23, 17]]) {
      const [x, z] = cellCenter(layout, c, r);
      expect(worldToCell(layout, x, z)).toEqual([c, r]);
    }
  });
});
