// 网格与 A*。纯函数，无副作用，不依赖 three.js。
// 规则与 server/app/layoutlib.py 逐条一致（blocked_cells / _door_open / reachable_cells / world_to_cell），
// 对账数据由 fixtures/gen_reference.py 用后端实现生成，grid.test.js 逐项比对。
import { ROBOT_RADIUS } from '../core/config.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const key = (c, r) => `${c},${r}`;

export function cellCenter(layout, c, r) {
  const { cell, origin } = layout.grid;
  return [origin[0] + (c + 0.5) * cell, origin[2] + (r + 0.5) * cell];
}

export function worldToCell(layout, x, z) {
  const { cell, origin } = layout.grid;
  return [Math.floor((x - origin[0]) / cell), Math.floor((z - origin[2]) / cell)];
}

export function inGrid(layout, c, r) {
  return c >= 0 && c < layout.grid.cols && r >= 0 && r < layout.grid.rows;
}

export function roomOfCell(layout, c, r) {
  for (const room of layout.rooms) {
    const [rc, rr, rw, rh] = room.rect;
    if (c >= rc && c < rc + rw && r >= rr && r < rr + rh) return room.id;
  }
  return null;
}

export function furnitureBox(f) {
  const [x, , z] = f.pos;
  const [w, , d] = f.size;
  return [x, z, x + w, z + d];
}

/** 家具包围盒外扩 radius 后，中心落入其内的格子不可通行。 */
export function blockedCells(layout, radius = ROBOT_RADIUS) {
  const boxes = layout.furniture.filter((f) => f.blocks).map(furnitureBox);
  const out = new Set();
  for (let c = 0; c < layout.grid.cols; c++) {
    for (let r = 0; r < layout.grid.rows; r++) {
      const [cx, cz] = cellCenter(layout, c, r);
      if (boxes.some(([x0, z0, x1, z1]) => x0 - radius <= cx && cx <= x1 + radius && z0 - radius <= cz && cz <= z1 + radius)) {
        out.add(key(c, r));
      }
    }
  }
  return out;
}

/** 相邻两格 a→b 是否被墙挡住：同分区放行，跨分区只在门洞范围内放行。 */
export function doorOpen(layout, a, b) {
  const ra = roomOfCell(layout, ...a);
  const rb = roomOfCell(layout, ...b);
  if (ra === null || rb === null) return false;
  if (ra === rb) return true;
  const [ax, az] = cellCenter(layout, ...a);
  const [bx, bz] = cellCenter(layout, ...b);
  const mx = (ax + bx) / 2;
  const mz = (az + bz) / 2;
  const s = layout.grid.cell;
  for (const d of layout.doors || []) {
    if (!(d.between.includes(ra) && d.between.includes(rb))) continue;
    const [dx, , dz] = d.pos;
    const half = d.width / 2 + 1e-9;
    if (d.axis === 'z' && Math.abs(mx - dx) <= s && Math.abs(mz - dz) <= half) return true;
    if (d.axis === 'x' && Math.abs(mz - dz) <= s && Math.abs(mx - dx) <= half) return true;
  }
  return false;
}

export function buildGrid(layout, radius = ROBOT_RADIUS) {
  return { layout, blocked: blockedCells(layout, radius) };
}

const walkable = (grid, c, r) => inGrid(grid.layout, c, r) && !grid.blocked.has(key(c, r));
const edgeOk = (grid, a, b) => walkable(grid, b[0], b[1]) && doorOpen(grid.layout, a, b);

/** 一步 a→b（相邻格）是否可走；对角步禁止穿角。 */
export function stepOk(grid, a, b) {
  if (!edgeOk(grid, a, b)) return false;
  const dc = b[0] - a[0];
  const dr = b[1] - a[1];
  if (dc && dr) return edgeOk(grid, a, [a[0] + dc, a[1]]) && edgeOk(grid, a, [a[0], a[1] + dr]);
  return true;
}

/** 从 start 格出发可达的全部格，返回 Set<"c,r">。起点不可走则为空集。 */
export function reachableCells(grid, start) {
  if (!walkable(grid, start[0], start[1])) return new Set();
  const seen = new Set([key(...start)]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    for (const [dc, dr] of DIRS) {
      const nxt = [cur[0] + dc, cur[1] + dr];
      if (seen.has(key(...nxt)) || !stepOk(grid, cur, nxt)) continue;
      seen.add(key(...nxt));
      queue.push(nxt);
    }
  }
  return seen;
}

function distToBox(px, pz, [x0, z0, x1, z1]) {
  return Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(z0 - pz, 0, pz - z1));
}

/**
 * 取最近可通行格。reach 是候选格集合（"c,r"）；不传则取所有可走格。
 * box 给定时按到包围盒的距离排序（目标是家具），否则按到点 (x,z) 的距离。
 * 并列时取行优先、列优先靠前者，保证结果确定。无候选返回 null。
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

/** 8 邻域 A*，对角代价 √2，禁止穿角。返回格子序列（含起点终点）或 null。 */
export function astar(grid, start, goal) {
  const { cols } = grid.layout.grid;
  const id = (c, r) => r * cols + c;
  const g = new Map([[id(...start), 0]]);
  const from = new Map();
  const open = new Set([id(...start)]);
  const closed = new Set();
  const h = (c, r) => {
    const dx = Math.abs(c - goal[0]);
    const dy = Math.abs(r - goal[1]);
    return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  const cellOf = (i) => [i % cols, Math.floor(i / cols)];
  while (open.size) {
    let cur = -1;
    let curF = Infinity;
    for (const i of open) {
      const [c, r] = cellOf(i);
      const f = g.get(i) + h(c, r);
      if (f < curF - 1e-12 || (Math.abs(f - curF) <= 1e-12 && i < cur)) { cur = i; curF = f; }
    }
    open.delete(cur);
    closed.add(cur);
    const cc = cellOf(cur);
    if (cc[0] === goal[0] && cc[1] === goal[1]) {
      const path = [cc];
      let p = cur;
      while (from.has(p)) { p = from.get(p); path.push(cellOf(p)); }
      return path.reverse();
    }
    for (const [dc, dr] of DIRS) {
      const nxt = [cc[0] + dc, cc[1] + dr];
      if (!stepOk(grid, cc, nxt)) continue;
      const ni = id(...nxt);
      if (closed.has(ni)) continue;
      const ng = g.get(cur) + (dc && dr ? Math.SQRT2 : 1);
      if (!g.has(ni) || ng < g.get(ni) - 1e-12) { g.set(ni, ng); from.set(ni, cur); open.add(ni); }
    }
  }
  return null;
}

/** 两格中心连线是否畅通：沿线每 0.05 米采样，相邻采样格之间的步都必须 stepOk。 */
function lineClear(grid, a, b) {
  const [ax, az] = cellCenter(grid.layout, ...a);
  const [bx, bz] = cellCenter(grid.layout, ...b);
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.05));
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const cur = worldToCell(grid.layout, ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n);
    if (cur[0] === prev[0] && cur[1] === prev[1]) continue;
    if (Math.abs(cur[0] - prev[0]) > 1 || Math.abs(cur[1] - prev[1]) > 1) return false;
    if (!stepOk(grid, prev, cur)) return false;
    prev = cur;
  }
  return true;
}

/** 去掉共线冗余拐点：能直达就跳过中间格。 */
export function smoothPath(grid, cells) {
  if (cells.length <= 2) return cells;
  const out = [cells[0]];
  let anchor = 0;
  for (let i = 2; i < cells.length; i++) {
    if (!lineClear(grid, cells[anchor], cells[i])) {
      out.push(cells[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(cells[cells.length - 1]);
  return out;
}

/**
 * 世界坐标求路径。返回 {cells, points, goalCell, snapped}：
 *   points 是不含起点的 [x,z] 路径点（末点为终点格中心，终点格本身可走时末点用精确终点）。
 *   起点与终点同格返回空路径；终点在家具内或不可达时落到最近可通行格（snapped=true）；
 *   目标是家具时传 box，按到包围盒的距离选落点。无路返回 null。
 */
export function findPath(grid, from, to, { box = null } = {}) {
  const { layout } = grid;
  let s = worldToCell(layout, from[0], from[1]);
  if (!walkable(grid, ...s)) {
    const n = nearestWalkable(grid, from[0], from[1]);
    if (!n) return null;
    s = n.cell;
  }
  const reach = reachableCells(grid, s);
  let g = worldToCell(layout, to[0], to[1]);
  let snapped = false;
  if (box || !walkable(grid, ...g) || !reach.has(key(...g))) {
    const n = nearestWalkable(grid, to[0], to[1], { reach, box });
    if (!n) return null;
    snapped = n.cell[0] !== g[0] || n.cell[1] !== g[1];
    g = n.cell;
  }
  if (s[0] === g[0] && s[1] === g[1]) return { cells: [s], points: [], goalCell: g, snapped };
  const raw = astar(grid, s, g);
  if (!raw) return null;
  const cells = smoothPath(grid, raw);
  const points = cells.slice(1).map((c) => cellCenter(layout, ...c));
  if (!snapped) points[points.length - 1] = [to[0], to[1]];
  return { cells, points, goalCell: g, snapped };
}
