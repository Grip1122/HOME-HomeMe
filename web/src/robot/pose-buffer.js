/**
 * 权威位姿的插值缓冲（步骤 1.2）。
 *
 * 移植自 `reference/hackerson/web/motion.mjs`：服务端 60 Hz 出位姿，浏览器约 20 Hz 取，
 * 渲染帧之间必须插值，否则机器人是跳着走的；但**断流时只能保持最后位姿，不能外推**——
 * 外推会把机器人推进墙里。
 *
 * 与原始实现的差别只有一处：时钟可注入（`now`），否则 Node 里跑测试要 patch 全局。
 */

const DEFAULT_DELAY_MS = 100;
const MAX_SAMPLES = 90;
const MAX_GAP_MS = 3000;
const MAX_DELAY_MS = 2500;

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class PoseBuffer {
  /**
   * @param {{delay?:number, now?:() => number}} [options]
   */
  constructor(options = {}) {
    this.delay = options.delay ?? DEFAULT_DELAY_MS;
    this.now = options.now ?? defaultNow;
    this.samples = [];
    this.epoch = null;
    this.sequence = -1;
    this.offset = null;
    this.lastReceived = null;
    this.gap = 50;
  }

  /**
   * @param {{xy:[number,number], yaw?:number, height?:number, tilt_deg?:number,
   *          sequence:number, server_time:number, epoch?:string, scene?:string}} pose
   * @returns {boolean} 是否采纳（重复序号、乱序、缺字段一律丢弃）
   */
  push(pose, received = this.now()) {
    if (!pose?.xy || !Number.isFinite(pose.server_time)) return false;
    const epoch = pose.epoch ?? pose.scene;
    if (epoch !== this.epoch) this.reset(epoch);
    if (!(pose.sequence > this.sequence)) return false;

    this.sequence = pose.sequence;
    if (this.lastReceived !== null) {
      this.gap = 0.65 * this.gap + 0.35 * Math.min(MAX_GAP_MS, received - this.lastReceived);
    }
    this.lastReceived = received;

    const offset = received - pose.server_time * 1000;
    this.offset = this.offset === null ? offset : Math.min(this.offset, offset);
    this.samples.push({ ...pose, t: pose.server_time * 1000 });
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
    return true;
  }

  reset(epoch = null) {
    this.samples = [];
    this.epoch = epoch;
    this.sequence = -1;
    this.offset = null;
    this.lastReceived = null;
    this.gap = 50;
  }

  /** 断流 / 未收到任何位姿时返回 null，调用方保持上一帧即可。 */
  sample(now = this.now()) {
    if (!this.samples.length) return null;
    const adaptive = this.gap > 100 ? this.gap * 1.8 : 0;
    const time = now - this.offset - Math.max(this.delay, Math.min(MAX_DELAY_MS, adaptive));
    while (this.samples.length > 2 && this.samples[1].t <= time) this.samples.shift();

    const a = this.samples[0];
    const b = this.samples[1];
    if (!b || time <= a.t) return a;
    if (time >= b.t) return b;

    const blend = Math.max(0, Math.min(1, (time - a.t) / (b.t - a.t)));
    const mix = (x, y) => x + (y - x) * blend;
    const turn = ((b.yaw ?? 0) - (a.yaw ?? 0) + Math.PI) % (Math.PI * 2);
    const shortest = (turn < 0 ? turn + Math.PI * 2 : turn) - Math.PI;
    return {
      ...b,
      xy: [mix(a.xy[0], b.xy[0]), mix(a.xy[1], b.xy[1])],
      yaw: (a.yaw ?? 0) + shortest * blend,
      height: mix(a.height ?? 0, b.height ?? 0),
      tilt_deg: mix(a.tilt_deg ?? 0, b.tilt_deg ?? 0),
      interpolation: blend,
    };
  }
}
