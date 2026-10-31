/**
 * A* 寻路 + 视线拉直（步骤 1.3）。
 *
 * 与 `grid.js` 共用同一套通行规则：8 邻域、禁止穿角、跨分区只走门洞。
 * 拉直用**超覆盖（supercover）格遍历**判定视线，而不是按固定间距采点——
 * 固定间距会在门框角点上漏检，桌角/门柱旁边就会出现“擦墙而过”的路径。
 */

import { canStep, inGrid, key, nearestPassable, blockedCells } from './grid.js';

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** 八向距离，与 A* 的步长一致：直走 1，斜走 √2。 */
function heuristic(a, b) {
  const dx = Math.abs(a[0] - b[0]);
  const dy = Math.abs(a[1] - b[1]);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/**
 * @returns {{cells: Array<[number,number]>, cost: number} | null}
 *   null = 不可达；起终点相同时返回单格路径、cost 0。
 */
export function astar(layout, from, to, blocked = blockedCells(layout)) {
  if (!inGrid(layout, from[0], from[1]) || !inGrid(layout, to[0], to[1])) return null;
  if (blocked.has(key(from[0], from[1])) || blocked.has(key(to[0], to[1]))) return null;
  if (from[0] === to[0] && from[1] === to[1]) return { cells: [[from[0], from[1]]], cost: 0 };

  const start = key(from[0], from[1]);
  const goal = key(to[0], to[1]);
  const gScore = new Map([[start, 0]]);
  const came = new Map();
  const open = [{ cell: [from[0], from[1]], f: heuristic(from, to) }];
  const closed = new Set();

  while (open.length) {
    // 稳定取最小 f：同 f 时取格子下标小的，保证同一输入永远同一条路。
    let bestIndex = 0;
    for (let i = 1; i < open.length; i += 1) {
      const a = open[i];
      const b = open[bestIndex];
      if (a.f < b.f - 1e-12 || (Math.abs(a.f - b.f) <= 1e-12 && cmpCell(a.cell, b.cell) < 0)) {
        bestIndex = i;
      }
    }
    const cur = open.splice(bestIndex, 1)[0].cell;
    const curKey = key(cur[0], cur[1]);
    if (curKey === goal) break;
    if (closed.has(curKey)) continue;
    closed.add(curKey);

    const base = gScore.get(curKey);
    for (const [dc, dr] of DIRS) {
      const nxt = [cur[0] + dc, cur[1] + dr];
      const nxtKey = key(nxt[0], nxt[1]);
      if (closed.has(nxtKey)) continue;
      if (!canStep(layout, cur, nxt, blocked)) continue;
      const step = dc && dr ? Math.SQRT2 : 1;
      const tentative = base + step;
      if (tentative < (gScore.get(nxtKey) ?? Infinity) - 1e-12) {
        gScore.set(nxtKey, tentative);
        came.set(nxtKey, cur);
        open.push({ cell: nxt, f: tentative + heuristic(nxt, to) });
      }
    }
  }

  if (!gScore.has(goal)) return null;
  const cells = [];
  let cursor = [to[0], to[1]];
  while (cursor) {
    cells.push(cursor);
    const parent = came.get(key(cursor[0], cursor[1]));
    if (!parent) break;
    cursor = parent;
  }
  cells.reverse();
  return { cells, cost: gScore.get(goal) };
}

function cmpCell(a, b) {
  return a[0] - b[0] || a[1] - b[1];
}

/**
 * 超覆盖格遍历：返回线段经过的**所有**格子（含起终点所在格）。
 * 用于判断两格之间是否直接可走；门洞、墙角都能被测到。
 */
export function lineCells(a, b) {
  const out = [];
  let [x0, y0] = a;
  const [x1, y1] = b;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const nx = Math.abs(dx);
  const ny = Math.abs(dy);
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  let ix = 0;
  let iy = 0;
  out.push([x0, y0]);
  while (ix < nx || iy < ny) {
    // 比较下一次跨格的距离，取更近的一侧；相等时两格都算经过（角点保守处理）。
    const tx = nx === 0 ? Infinity : (ix + 0.5) / nx;
    const ty = ny === 0 ? Infinity : (iy + 0.5) / ny;
    if (Math.abs(tx - ty) < 1e-12) {
      out.push([x0 + sx, y0]);
      x0 += sx;
      y0 += sy;
      out.push([x0, y0]);
      ix += 1;
      iy += 1;
    } else if (tx < ty) {
      x0 += sx;
      ix += 1;
      out.push([x0, y0]);
    } else {
      y0 += sy;
      iy += 1;
      out.push([x0, y0]);
    }
  }
  return dedupe(out);
}

function dedupe(cells) {
  const seen = new Set();
  const out = [];
  for (const cell of cells) {
    const k = key(cell[0], cell[1]);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(cell);
  }
  return out;
}

/** 两格之间是否“看得见”（整条线段都在可通行区内，且每步都过得了门洞）。 */
export function lineOfSight(layout, a, b, blocked = blockedCells(layout)) {
  const path = lineCells(a, b);
  for (let i = 0; i < path.length; i += 1) {
    if (!inGrid(layout, path[i][0], path[i][1])) return false;
    if (blocked.has(key(path[i][0], path[i][1]))) return false;
    if (i === 0) continue;
    if (!stepAllowed(layout, path[i - 1], path[i], blocked)) return false;
  }
  return true;
}

/**
 * 超覆盖相邻格可能是斜向贴角（如 (0,0)→(1,1)），仍按 canStep 的禁穿角规则判。
 * 非相邻的“跳格”说明线段擦过了角点，直接判不可见（保守）。
 */
function stepAllowed(layout, a, b, blocked) {
  const dc = b[0] - a[0];
  const dr = b[1] - a[1];
  if (Math.abs(dc) > 1 || Math.abs(dr) > 1) return false;
  return canStep(layout, a, b, blocked);
}

/** 贪心视线拉直：从当前点尽量往最远的可见点跳。 */
export function smoothPath(layout, cells, blocked = blockedCells(layout)) {
  if (cells.length <= 2) return cells.map((c) => [c[0], c[1]]);
  const out = [[cells[0][0], cells[0][1]]];
  let i = 0;
  while (i < cells.length - 1) {
    let j = cells.length - 1;
    while (j > i + 1 && !lineOfSight(layout, cells[i], cells[j], blocked)) j -= 1;
    out.push([cells[j][0], cells[j][1]]);
    i = j;
  }
  return out;
}

/**
 * 一次到位的对外入口：目标在阻挡格时先落到最近可通行格。
 * @param {{from: number[], to: number[], blocked?: Set<string>, smooth?: boolean}} opts
 */
export function findPath(layout, { from, to, blocked = blockedCells(layout), smooth = true }) {
  const goal = nearestPassable(layout, [Math.round(to[0]), Math.round(to[1])], blocked);
  if (!goal) return null;
  const result = astar(layout, [Math.round(from[0]), Math.round(from[1])], goal, blocked);
  if (!result) return null;
  const cells = smooth ? smoothPath(layout, result.cells, blocked) : result.cells;
  return { cells, cost: result.cost, goal };
}
