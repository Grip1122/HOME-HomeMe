/**
 * 场景坐标标定（步骤 0.3 / 1.1，设计 B 的地盘）。
 *
 * 高斯泼溅素材（`assets/gaussian-splat/scene.ply`）来自重建坐标系，**不是** three.js 的
 * Y 向上坐标系；`reference/hackerson` 里已经踩过一遍，结论写在这里，前端直接用。
 *
 * 三层坐标：
 *   1. 原始重建坐标（PLY 文件里的 x y z，单位未标定）
 *   2. 仿真坐标（米制、y 向上，layout JSON 用的就是它）
 *   3. 渲染坐标（three.js，y 向上，`z` 取反以对齐右手系）
 *
 * 唯一真值仍是 `contracts/layout.schema.json`：坐标单位米，y 轴向上，网格只管 x-z。
 */

/** 原始 → 仿真：`[x, z, -y + groundOffset]`。groundOffset 把地面抬到 y=0。 */
export const DEFAULT_GROUND_OFFSET = 0.07;

export function rawToSim(point, { groundOffset = DEFAULT_GROUND_OFFSET, scale = 1 } = {}) {
  const [x, y, z] = point;
  return [x * scale, z * scale, -y * scale + groundOffset];
}

export function simToRaw(point, { groundOffset = DEFAULT_GROUND_OFFSET, scale = 1 } = {}) {
  const [x, y, z] = point;
  return [x / scale, -(z - groundOffset) / scale, y / scale];
}

/** 仿真平面 (x, z) → three.js (x, z)。只做轴翻转，不动高度。 */
export function simToRender(xy) {
  return [xy[0], -(xy[1] ?? 0)];
}

export function renderToSim(xz) {
  return [xz[0], -(xz[1] ?? 0)];
}

/**
 * 用一处已知尺寸求缩放系数。高斯素材的单位未定，**没量过就不要假设是米**。
 * @param {number} units 在场景里量到的长度（重建坐标单位）
 * @param {number} meters 同一处的真实长度（米），例如门宽 0.9、桌高 0.75
 * @returns {{scale:number, calibrated:true, units:number, meters:number}}
 */
export function calibrateScale(units, meters) {
  if (!(units > 0) || !(meters > 0)) {
    throw new RangeError(`标定需要两个正数，收到 units=${units} meters=${meters}`);
  }
  return { scale: meters / units, calibrated: true, units, meters };
}

/**
 * 把高斯点云的包围盒换算成仿真坐标下的可通行范围。
 * 只做保守收缩：取 1%–99% 分位区间，外围稀疏高斯（天空、重建噪声）不参与。
 */
export function roiToSimBounds(roi, options = {}) {
  if (!roi?.min || !roi?.max) throw new TypeError('roi 需要 min / max');
  const a = rawToSim(roi.min, options);
  const b = rawToSim(roi.max, options);
  return {
    min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
    extent: [
      Math.abs(a[0] - b[0]),
      Math.abs(a[1] - b[1]),
      Math.abs(a[2] - b[2]),
    ],
  };
}

/** 与 layout 的网格对齐：世界点是否落在网格内。 */
export function insideGrid(layout, x, z) {
  const g = layout.grid;
  return (
    x >= g.origin[0] &&
    x <= g.origin[0] + g.cols * g.cell &&
    z >= g.origin[2] &&
    z <= g.origin[2] + g.rows * g.cell
  );
}
