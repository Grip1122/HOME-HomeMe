// 世界坐标路径规划：动作层（robot/actions.js）唯一的寻路入口。
// A* 与视线拉直全部用 astar.js（PR #9，与 layoutlib.py 同规则），这里只做三件 astar.findPath 不管的事：
//   1. 世界坐标 ⇄ 格子；起点格被挡时先落到最近可通行格（机器人可能被"传送"到家具边上）。
//   2. 终点只在起点的可达集里选，避免选到被家具围死、实际走不到的格。
//   3. 目标是家具时按"格心到包围盒的距离"选落点，保证到达后水平距离 < GRAB_RADIUS 能判得过。
import { blockedCells, cellCenter, worldToCell, inGrid, key, reachableCells } from './grid.js';
import { astar, smoothPath } from './astar.js';

/** 动作层用的网格对象：layout + 阻挡格集合，建一次反复用。 */
export function buildGrid(layout) {
  return { layout, blocked: blockedCells(layout) };
}

const walkable = (grid, c, r) => inGrid(grid.layout, c, r) && !grid.blocked.has(key(c, r));

/** 点到轴对齐矩形 [x0,z0,x1,z1] 的水平距离；在矩形内为 0。 */
export function distToBox(px, pz, [x0, z0, x1, z1]) {
  return Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(z0 - pz, 0, pz - z1));
}

/**
 * 最近可通行格。reach 给定时只在其中选；box 给定时按到包围盒距离，否则按到 (x,z) 距离。
 * 并列取行优先、列优先靠前者，结果确定。无候选返回 null。
 */
export function nearestWalkable(grid, x, z, { reach = null, box = null } = {}) {
  const { cols, rows } = grid.layout.grid;
  let best = null;
  let bestD = Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!walkable(grid, c, r)) continue;
      if (reach && !reach.has(key(c, r))) continue;
      const [cx, cz] = cellCenter(grid.layout, c, r);
      const d = box ? distToBox(cx, cz, box) : Math.hypot(cx - x, cz - z);
      if (d < bestD - 1e-12) { bestD = d; best = [c, r]; }
    }
  }
  return best && { cell: best, dist: bestD };
}

/**
 * 世界坐标求路径。返回 {cells, points, goalCell, snapped}：
 *   points 是不含起点的 [x,z] 路径点；终点格可直接到达时末点用精确终点，否则用落点格中心（snapped=true）。
 *   起点与终点同格返回空路径；无路返回 null。
 */
export function planRoute(grid, from, to, { box = null } = {}) {
  const { layout, blocked } = grid;
  let s = worldToCell(layout, from[0], from[1]);
  if (!walkable(grid, ...s)) {
    const n = nearestWalkable(grid, from[0], from[1]);
    if (!n) return null;
    s = n.cell;
  }
  const reach = reachableCells(layout, s, blocked);
  let g = worldToCell(layout, to[0], to[1]);
  let snapped = false;
  if (box || !walkable(grid, ...g) || !reach.has(key(...g))) {
    const n = nearestWalkable(grid, to[0], to[1], { reach, box });
    if (!n) return null;
    snapped = n.cell[0] !== g[0] || n.cell[1] !== g[1];
    g = n.cell;
  }
  if (s[0] === g[0] && s[1] === g[1]) return { cells: [s], points: [], goalCell: g, snapped };
  const raw = astar(layout, s, g, blocked);
  if (!raw) return null;
  const cells = smoothPath(layout, raw.cells, blocked);
  const points = cells.slice(1).map((c) => cellCenter(layout, ...c));
  if (!snapped) points[points.length - 1] = [to[0], to[1]];
  return { cells, points, goalCell: g, snapped };
}
