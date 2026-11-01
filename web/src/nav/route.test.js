import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildGrid, planRoute, nearestWalkable, distToBox } from './route.js';
import { worldToCell, canStep, furnitureBox, key, GRAB_RADIUS } from './grid.js';
import { lineCells } from './astar.js';

const layout = JSON.parse(readFileSync(new URL('../../public/layouts/layout_A.json', import.meta.url), 'utf-8'));
const grid = buildGrid(layout);
const cellOf = ([x, z]) => worldToCell(layout, x, z);

/** 路径点之间逐段用超覆盖格检查：每一步都必须能走（不穿家具、不穿墙、不穿角）。 */
function assertWalkable(from, points) {
  let prev = cellOf(from);
  for (const p of points) {
    const seg = lineCells(prev, cellOf(p));
    for (let i = 1; i < seg.length; i++) expect(canStep(layout, seg[i - 1], seg[i], grid.blocked), `${seg[i - 1]}→${seg[i]}`).toBe(true);
    prev = cellOf(p);
  }
}

describe('route：动作层寻路入口（A* 用 astar.js）', () => {
  it('客厅到书房穿过门洞，每一段都可走，终点精确落在目标点', () => {
    const r = planRoute(grid, [-1.5, 0], [3.0, 2.0]);
    expect(r).not.toBeNull();
    expect(r.snapped).toBe(false);
    expect(r.points.at(-1)).toEqual([3.0, 2.0]);
    assertWalkable([-1.5, 0], r.points);
    const xs = r.points.map(([x]) => x);
    expect(Math.max(...xs)).toBeGreaterThan(0); // 真的跨过了 x=0 的隔墙
  });

  it('目标是家具：落点格在可达集里，且离包围盒 < GRAB_RADIUS（到了就够得着）', () => {
    for (const f of layout.furniture) {
      const box = furnitureBox(f);
      const r = planRoute(grid, [-1.5, 0], [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2], { box });
      expect(r, f.id).not.toBeNull();
      const [x, z] = r.points.at(-1) ?? [-1.5, 0];
      expect(distToBox(x, z, box), f.id).toBeLessThan(GRAB_RADIUS);
      expect(grid.blocked.has(key(...r.goalCell))).toBe(false);
    }
  });

  it('起点在家具里（被拖进去了）先吸附到最近可通行格，仍能规划', () => {
    const r = planRoute(grid, [-3.4, 0.0], [3.0, -1.5]); // 茶几内部
    expect(r).not.toBeNull();
    expect(grid.blocked.has(key(...r.cells[0]))).toBe(false);
  });

  it('目标是家具时按"到包围盒距离"选落点，而不是按"到中心点距离"', () => {
    // 沙发 2.2×0.9 米：离中心最近的可走格在它正前方 1.25 米外，离包围盒却有 0.65 米；
    // 按包围盒选的落点离沙发更近，到了才够得着。
    const f = layout.furniture.find((x) => x.id === 'sofa');
    const box = furnitureBox(f);
    const c = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    const byBox = nearestWalkable(grid, ...c, { box });
    const byPoint = nearestWalkable(grid, ...c);
    expect(byBox.cell).not.toEqual(byPoint.cell);
    const r = planRoute(grid, [-1.5, 0], c, { box });
    expect(r.goalCell).toEqual(byBox.cell);
  });

  it('终点只在起点的可达集里选：被封死的格子不会被选为落点', () => {
    // 人为把书房整个封起来，只留书桌左下角一格可走但与外界不连通
    const blocked = new Set(grid.blocked);
    for (let c = 12; c < 24; c++) for (let r = 9; r < 18; r++) blocked.add(key(c, r));
    const lone = worldToCell(layout, 2.75, 3.25);
    blocked.delete(key(...lone));
    const g2 = { layout, blocked };
    const r = planRoute(g2, [-1.5, 0], [2.75, 3.25]);
    expect(r).not.toBeNull();
    expect(r.goalCell).not.toEqual(lone);
    assertWalkable([-1.5, 0], r.points);
  });

  it('同格返回空路径；网格外无可走格时返回 null', () => {
    expect(planRoute(grid, [-1.5, 0], [-1.4, 0.1]).points).toEqual([]);
    const sealed = { layout, blocked: new Set(Array.from({ length: 24 * 18 }, (_, i) => key(i % 24, Math.floor(i / 24)))) };
    expect(planRoute(sealed, [-1.5, 0], [3, 2])).toBeNull();
    expect(nearestWalkable(sealed, 0, 0)).toBeNull();
  });
});
