/**
 * 寻路网格：世界坐标 ⇄ 格子、家具阻挡、门洞连通、可达集。
 *
 * 本模块是 `server/app/layoutlib.py` 的**同规则前端实现**（步骤 1.3）。
 * 两边任何一处不一致，`web/src/nav/grid.test.js` 会读 `__fixtures__` 里的参照快照变红；
 * 快照由 `scripts/gen_nav_fixture.py` 从 layoutlib 生成，`tests/test_nav_fixture.py` 保证不过期。
 *
 * 纯函数，无副作用，不依赖 three.js，可在 Node 里直接跑。
 */

export const ROBOT_RADIUS = 0.25; // 米，A* 外扩半径
export const GRAB_RADIUS = 1.0; // 米，逻辑上“够得着”的水平距离

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

/** 家具包围盒 [x0, z0, x1, z1]；layout 里 pos 是“底面前-左角”，size 是 [宽, 高, 深]。 */
export function furnitureBox(f) {
  const [x, , z] = f.pos;
  const [w, , d] = f.size;
  return [x, z, x + w, z + d];
}

export function furnitureTop(f) {
  return f.pos[1] + f.size[1];
}

export function cellCenter(layout, c, r) {
  const g = layout.grid;
  const s = g.cell;
  return [g.origin[0] + (c + 0.5) * s, g.origin[2] + (r + 0.5) * s];
}

export function worldToCell(layout, x, z) {
  const g = layout.grid;
  const s = g.cell;
  return [Math.floor((x - g.origin[0]) / s), Math.floor((z - g.origin[2]) / s)];
}

export function inGrid(layout, c, r) {
  const g = layout.grid;
  return c >= 0 && c < g.cols && r >= 0 && r < g.rows;
}

export function roomOfCell(layout, c, r) {
  for (const room of layout.rooms) {
    const [rc, rr, rw, rh] = room.rect;
    if (c >= rc && c < rc + rw && r >= rr && r < rr + rh) return room.id;
  }
  return null;
}

export function roomById(layout, id) {
  return layout.rooms.find((room) => room.id === id) ?? null;
}

/**
 * 家具包围盒外扩 radius 后，中心落入其内的格子不可通行。
 * 与 layoutlib.blocked_cells 同一判据：闭区间比较。
 */
export function blockedCells(layout, radius = ROBOT_RADIUS) {
  const g = layout.grid;
  const boxes = layout.furniture.filter((f) => f.blocks).map(furnitureBox);
  const out = new Set();
  for (let c = 0; c < g.cols; c += 1) {
    for (let r = 0; r < g.rows; r += 1) {
      const [cx, cz] = cellCenter(layout, c, r);
      for (const [x0, z0, x1, z1] of boxes) {
        if (x0 - radius <= cx && cx <= x1 + radius && z0 - radius <= cz && cz <= z1 + radius) {
          out.add(key(c, r));
          break;
        }
      }
    }
  }
  return out;
}

/** 跨分区相邻格是否连通：只有落在 doors[] 宽度范围内的才算门。 */
export function doorOpen(layout, a, b) {
  const ra = roomOfCell(layout, a[0], a[1]);
  const rb = roomOfCell(layout, b[0], b[1]);
  if (ra === null || rb === null) return false;
  if (ra === rb) return true;
  const [ax, az] = cellCenter(layout, ...a);
  const [bx, bz] = cellCenter(layout, ...b);
  const mx = (ax + bx) / 2;
  const mz = (az + bz) / 2;
  const s = layout.grid.cell;
  for (const d of layout.doors ?? []) {
    const pair = d.between;
    const samePair =
      pair.length === 2 &&
      ((pair[0] === ra && pair[1] === rb) || (pair[0] === rb && pair[1] === ra));
    if (!samePair) continue;
    const half = d.width / 2 + 1e-9;
    const dx = d.pos[0];
    const dz = d.pos[2];
    if (d.axis === 'z' && Math.abs(mx - dx) <= s && Math.abs(mz - dz) <= half) return true;
    if (d.axis === 'x' && Math.abs(mz - dz) <= s && Math.abs(mx - dx) <= half) return true;
  }
  return false;
}

export function key(c, r) {
  return `${c},${r}`;
}

export function unkey(k) {
  const [c, r] = k.split(',').map(Number);
  return [c, r];
}

/** 两格之间是否可以走一步（含“禁止穿角”）。 */
export function canStep(layout, a, b, blocked) {
  if (!inGrid(layout, b[0], b[1]) || blocked.has(key(b[0], b[1]))) return false;
  if (!doorOpen(layout, a, b)) return false;
  if (a[0] !== b[0] && a[1] !== b[1]) {
    if (!canStep(layout, a, [a[0] + (b[0] - a[0]), a[1]], blocked)) return false;
    if (!canStep(layout, a, [a[0], a[1] + (b[1] - a[1])], blocked)) return false;
  }
  return true;
}

/** BFS 可达集；起点越界或被挡返回空集（与 layoutlib 一致）。 */
export function reachableCells(layout, startCell, blocked = blockedCells(layout)) {
  if (!inGrid(layout, startCell[0], startCell[1])) return new Set();
  if (blocked.has(key(startCell[0], startCell[1]))) return new Set();
  const seen = new Set([key(startCell[0], startCell[1])]);
  const queue = [startCell];
  while (queue.length) {
    const cur = queue.shift();
    for (const [dc, dr] of DIRS) {
      const nxt = [cur[0] + dc, cur[1] + dr];
      if (seen.has(key(nxt[0], nxt[1]))) continue;
      if (!canStep(layout, cur, nxt, blocked)) continue;
      seen.add(key(nxt[0], nxt[1]));
      queue.push(nxt);
    }
  }
  return seen;
}

/**
 * 目标落在阻挡格（家具内部）时，取周围最近的可通行格。
 * 同距离按格子下标升序取第一个，保证跨机、跨语言可复现。
 */
export function nearestPassable(layout, cell, blocked = blockedCells(layout)) {
  const g = layout.grid;
  const ok = (c, r) => inGrid(layout, c, r) && !blocked.has(key(c, r));
  if (ok(cell[0], cell[1])) return [cell[0], cell[1]];
  let best = null;
  let bestD = Infinity;
  for (let c = 0; c < g.cols; c += 1) {
    for (let r = 0; r < g.rows; r += 1) {
      if (!ok(c, r)) continue;
      const d = Math.hypot(c - cell[0], r - cell[1]);
      if (d < bestD - 1e-12) {
        bestD = d;
        best = [c, r];
      }
    }
  }
  return best;
}

/** 网格坐标 → 世界坐标（格心）。 */
export function cellsToWorld(layout, cells) {
  return cells.map(([c, r]) => cellCenter(layout, c, r));
}

export function toList(set) {
  return [...set].map(unkey).sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}
