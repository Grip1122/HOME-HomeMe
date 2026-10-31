/* global RF */
(function () {
  const RF = window.RF;

  const DIRS = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];

  class MinHeap {
    constructor() {
      this.a = [];
    }
    get size() {
      return this.a.length;
    }
    push(node) {
      const a = this.a;
      a.push(node);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p].f <= a[i].f) break;
        const tmp = a[p];
        a[p] = a[i];
        a[i] = tmp;
        i = p;
      }
    }
    pop() {
      const a = this.a;
      const top = a[0];
      const last = a.pop();
      if (a.length && last) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < a.length && a[l].f < a[m].f) m = l;
          if (r < a.length && a[r].f < a[m].f) m = r;
          if (m === i) break;
          const tmp = a[m];
          a[m] = a[i];
          a[i] = tmp;
          i = m;
        }
      }
      return top;
    }
  }

  class NavGrid {
    constructor(opts) {
      this.minX = opts.minX;
      this.maxX = opts.maxX;
      this.minZ = opts.minZ;
      this.maxZ = opts.maxZ;
      this.cell = opts.cell || 0.4;
      this.cols = Math.ceil((this.maxX - this.minX) / this.cell);
      this.rows = Math.ceil((this.maxZ - this.minZ) / this.cell);
      this.blocked = new Uint8Array(this.cols * this.rows);
      this.obstacles = [];
    }

    addObstacleBox(box, pad) {
      this.obstacles.push({
        minX: box.minX - (pad || 0),
        maxX: box.maxX + (pad || 0),
        minZ: box.minZ - (pad || 0),
        maxZ: box.maxZ + (pad || 0),
      });
    }

    bake() {
      const c = this.cell;
      for (let iz = 0; iz < this.rows; iz++) {
        for (let ix = 0; ix < this.cols; ix++) {
          const x = this.minX + (ix + 0.5) * c;
          const z = this.minZ + (iz + 0.5) * c;
          let b = 0;
          if (x < this.minX + c * 0.6 || x > this.maxX - c * 0.6 || z < this.minZ + c * 0.6 || z > this.maxZ - c * 0.6) b = 1;
          for (let i = 0; i < this.obstacles.length && !b; i++) {
            const o = this.obstacles[i];
            if (x >= o.minX && x <= o.maxX && z >= o.minZ && z <= o.maxZ) b = 1;
          }
          this.blocked[iz * this.cols + ix] = b;
        }
      }
    }

    idx(ix, iz) {
      return iz * this.cols + ix;
    }
    inBounds(ix, iz) {
      return Number.isInteger(ix) && Number.isInteger(iz) && ix >= 0 && iz >= 0 && ix < this.cols && iz < this.rows;
    }
    isBlockedCell(ix, iz) {
      if (!this.inBounds(ix, iz)) return true;
      return this.blocked[this.idx(ix, iz)] === 1;
    }
    inWorldBounds(x, z) {
      return Number.isFinite(x) && Number.isFinite(z) && x >= this.minX && x < this.maxX && z >= this.minZ && z < this.maxZ;
    }
    cellCenter(ix, iz) {
      const width = Math.min(1, (this.maxX - this.minX) / this.cell - ix);
      const depth = Math.min(1, (this.maxZ - this.minZ) / this.cell - iz);
      return {
        x: this.minX + (ix + width * 0.5) * this.cell,
        z: this.minZ + (iz + depth * 0.5) * this.cell,
      };
    }
    worldToCell(x, z) {
      return {
        ix: Math.floor((x - this.minX) / this.cell),
        iz: Math.floor((z - this.minZ) / this.cell),
      };
    }
    isBlockedWorld(x, z) {
      if (!this.inWorldBounds(x, z)) return true;
      const c = this.worldToCell(x, z);
      return this.isBlockedCell(c.ix, c.iz);
    }

    nearestFreeWorld(x, z, maxRing = 14) {
      if (!this.inWorldBounds(x, z) || !Number.isFinite(maxRing) || maxRing < 0) return null;
      const c = this.worldToCell(x, z);
      if (!this.isBlockedCell(c.ix, c.iz)) return this.cellCenter(c.ix, c.iz);
      const limit = Math.min(maxRing, Math.max(this.cols, this.rows));
      for (let r = 1; r <= limit; r++) {
        let best = null;
        let bestD = Infinity;
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const ix = c.ix + dx;
            const iz = c.iz + dz;
            if (this.isBlockedCell(ix, iz)) continue;
            const p = this.cellCenter(ix, iz);
            const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
            if (d < bestD) {
              bestD = d;
              best = p;
            }
          }
        }
        if (best) return best;
      }
      return null;
    }

    lineClear(ax, az, bx, bz) {
      if (this.isBlockedWorld(ax, az) || this.isBlockedWorld(bx, bz)) return false;
      const a = this.worldToCell(ax, az);
      const b = this.worldToCell(bx, bz);
      const dx = bx - ax;
      const dz = bz - az;
      const stepX = Math.sign(dx);
      const stepZ = Math.sign(dz);
      const deltaX = stepX ? this.cell / Math.abs(dx) : Infinity;
      const deltaZ = stepZ ? this.cell / Math.abs(dz) : Infinity;
      let nextX = stepX ? (this.minX + (a.ix + (stepX > 0 ? 1 : 0)) * this.cell - ax) / dx : Infinity;
      let nextZ = stepZ ? (this.minZ + (a.iz + (stepZ > 0 ? 1 : 0)) * this.cell - az) / dz : Infinity;
      while (a.ix !== b.ix || a.iz !== b.iz) {
        const crossX = a.ix === b.ix ? Infinity : nextX;
        const crossZ = a.iz === b.iz ? Infinity : nextZ;
        // 逐格遍历；经过格角时同时检查两侧，避免平滑穿角。
        if (Math.abs(crossX - crossZ) <= 1e-12) {
          if (this.isBlockedCell(a.ix + stepX, a.iz) || this.isBlockedCell(a.ix, a.iz + stepZ)) return false;
          a.ix += stepX;
          a.iz += stepZ;
          nextX += deltaX;
          nextZ += deltaZ;
        } else if (crossX < crossZ) {
          a.ix += stepX;
          nextX += deltaX;
        } else {
          a.iz += stepZ;
          nextZ += deltaZ;
        }
        if (this.isBlockedCell(a.ix, a.iz)) return false;
      }
      return true;
    }

    /** 八邻接 A* 与视线平滑；失败返回 null，同格返回单点路径。 */
    findPath(start, goal) {
      if (!start || !goal || !this.inWorldBounds(start.x, start.z) || !this.inWorldBounds(goal.x, goal.z)) return null;
      const s = this.nearestFreeWorld(start.x, start.z);
      const g = this.nearestFreeWorld(goal.x, goal.z);
      if (!s || !g) return null;
      const sc = this.worldToCell(s.x, s.z);
      const gc = this.worldToCell(g.x, g.z);
      const startIdx = this.idx(sc.ix, sc.iz);
      const goalIdx = this.idx(gc.ix, gc.iz);
      if (startIdx === goalIdx) return [s];
      const n = this.cols * this.rows;
      const gScore = new Float32Array(n);
      gScore.fill(Infinity);
      const came = new Int32Array(n);
      came.fill(-1);
      const closed = new Uint8Array(n);
      gScore[startIdx] = 0;

      const heap = new MinHeap();
      const h = (ix, iz) => {
        const dx = Math.abs(ix - gc.ix);
        const dz = Math.abs(iz - gc.iz);
        return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
      };
      heap.push({ idx: startIdx, ix: sc.ix, iz: sc.iz, f: h(sc.ix, sc.iz) });

      let found = false;
      let guard = 0;
      while (heap.size && guard++ < 30000) {
        const cur = heap.pop();
        if (closed[cur.idx]) continue;
        closed[cur.idx] = 1;
        if (cur.idx === goalIdx) {
          found = true;
          break;
        }
        for (let d = 0; d < DIRS.length; d++) {
          const nx = cur.ix + DIRS[d][0];
          const nz = cur.iz + DIRS[d][1];
          const cost = DIRS[d][2];
          if (this.isBlockedCell(nx, nz)) continue;
          if (d >= 4) {
            if (this.isBlockedCell(cur.ix + DIRS[d][0], cur.iz)) continue;
            if (this.isBlockedCell(cur.ix, cur.iz + DIRS[d][1])) continue;
          }
          const ni = this.idx(nx, nz);
          if (closed[ni]) continue;
          const ng = gScore[cur.idx] + cost;
          if (ng < gScore[ni]) {
            gScore[ni] = ng;
            came[ni] = cur.idx;
            heap.push({ idx: ni, ix: nx, iz: nz, f: ng + h(nx, nz) * 1.02 });
          }
        }
      }

      if (!found) return null;

      const raw = [];
      let cur = goalIdx;
      let guard2 = 0;
      while (cur !== -1 && guard2++ < n) {
        const ix = cur % this.cols;
        const iz = Math.floor(cur / this.cols);
        raw.push(this.cellCenter(ix, iz));
        if (cur === startIdx) break;
        cur = came[cur];
      }
      if (cur !== startIdx) return null;
      raw.reverse();
      raw[0] = s;
      raw[raw.length - 1] = g;

      // 视线拉直，保留可直达的最远路径点。
      if (raw.length > 2) {
        const out = [raw[0]];
        let anchor = 0;
        for (let i = 2; i < raw.length; i++) {
          if (!this.lineClear(raw[anchor].x, raw[anchor].z, raw[i].x, raw[i].z)) {
            out.push(raw[i - 1]);
            anchor = i - 1;
          }
        }
        out.push(raw[raw.length - 1]);
        return out;
      }
      return raw;
    }

    pathLength(path) {
      let d = 0;
      for (let i = 1; i < path.length; i++) {
        d += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
      }
      return d;
    }
  }

  RF.NavGrid = NavGrid;
})();
