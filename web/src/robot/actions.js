// 五个动作：find / go / grab / drop / observe。每个返回 Promise，只在 ticker 推进时前进。
// 逻辑层（能不能抓、抓谁、状态转移、记忆）都在这里；视觉层（动画片段）由 robot.js 订阅 robot:state 完成，
// 视觉层不向这里回传任何信息（总览 2.7 节）。
//
// ctx = { layout, grid, world, robot, ticker, bus, sm, memory, options? , holding }
import * as THREE from 'three';
import {
  GRAB_RADIUS, CARRY_SCALE, ACTION_MAX_SECONDS, OBSERVE_SECONDS, CONFUSED_SECONDS, MEMORY,
} from '../core/config.js';
import { findPath, worldToCell, roomOfCell, distToBox } from '../nav/grid.js';
import { walkPath, turnTo, yawToward } from '../nav/walker.js';

const ZERO = new THREE.Vector3();
const hdist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const now = (ctx) => ctx.ticker.time;
const ms = (ctx, t0) => Math.round((now(ctx) - t0) * 1000);

/** 挂载并保持世界变换。全项目唯一的挂载入口：禁止对物体使用 add()（会瞬移）。 */
export function attachKeepWorld(parent, obj) {
  parent.attach(obj);
  return obj;
}

/** 把物体贴到家具台面：先 attach 保持世界位置，再单独设台面高度、缩放恢复 1、朝向归零。 */
export function settleOnSurface(furnitureGroup, mesh, wx, wz) {
  attachKeepWorld(furnitureGroup, mesh);
  mesh.position.set(
    wx - furnitureGroup.position.x,
    furnitureGroup.userData.top - furnitureGroup.position.y + mesh.userData.halfH,
    wz - furnitureGroup.position.z,
  );
  mesh.scale.setScalar(1);
  mesh.quaternion.identity();
}

function tween(ctx, signal, seconds, fn) {
  let t = 0;
  return ctx.ticker.until((dt) => {
    t = Math.min(seconds, t + dt);
    fn(seconds > 0 ? t / seconds : 1);
    return t >= seconds - 1e-9;
  }, signal);
}

const robotRoom = (ctx) => {
  const [x, , z] = ctx.robot.pos;
  return roomOfCell(ctx.layout, ...worldToCell(ctx.layout, x, z));
};

function blocked(ctx, reason) {
  ctx.bus.emit('robot:blocked', { reason, at: ctx.robot.pos });
  return { ok: false, reason };
}

export function holdingMesh(ctx) {
  return ctx.holding ? ctx.world.getObject(ctx.holding) : null;
}

/** 把"物体 / 家具 / 分区 id"解析成寻路目标。 */
function resolveGoal(ctx, target) {
  const room = ctx.layout.rooms.find((r) => r.id === target);
  if (room) return { to: [room.scan_point[0], room.scan_point[2]], box: null };
  const f = ctx.world.getFurniture(target);
  if (f) {
    const [x0, z0, x1, z1] = f.userData.box;
    return { to: [(x0 + x1) / 2, (z0 + z1) / 2], box: f.userData.box };
  }
  if (ctx.world.getObject(target)) {
    const p = ctx.world.worldPos(target);
    return { to: [p[0], p[2]], box: null };
  }
  throw new RangeError(`未知目标: ${target}`);
}

/** 走到目标的可达邻格。分区则走到扫描点。 */
export async function go(ctx, target, { signal, step = null, taskId = null } = {}) {
  if (ctx.holding === target) return { ok: true };
  const goal = resolveGoal(ctx, target);
  ctx.sm.moveTo('walking', { step, taskId });
  const [x, , z] = ctx.robot.pos;
  const path = findPath(ctx.grid, [x, z], goal.to, { box: goal.box });
  if (!path) return blocked(ctx, 'no_path');
  await walkPath({ robot: ctx.robot, ticker: ctx.ticker, bus: ctx.bus, points: path.points, signal });
  return { ok: true };
}

/** 原地环顾一周，返回该分区里看得见的物体并写入记忆。 */
export async function observe(ctx, room = null, { signal, step = null, taskId = null } = {}) {
  const roomId = room ?? robotRoom(ctx);
  ctx.sm.moveTo('scanning', { step, taskId });
  const y0 = ctx.robot.yaw;
  const seconds = ctx.options?.observeSeconds ?? OBSERVE_SECONDS;
  await tween(ctx, signal, seconds, (k) => ctx.robot.setPose(ctx.robot.pos[0], ctx.robot.pos[2], y0 + Math.PI * 2 * k));
  ctx.robot.setPose(ctx.robot.pos[0], ctx.robot.pos[2], y0);
  const seen = ctx.world.objectsInRoom(roomId)
    .filter((id) => id !== ctx.holding)
    .map((id) => ({ id, room: roomId, pos: ctx.world.worldPos(id) }));
  if (ctx.memory.enabled) ctx.memory.upsert(seen);
  return { ok: true, seen };
}

/** 抓取/放置的单飞锁：进行中再次调用直接拒绝；锁在 finally 中释放，动画抛错也不会卡死。 */
async function withHandLock(ctx, fn) {
  if (ctx.handBusy) return blocked(ctx, 'busy');
  ctx.handBusy = true;
  try {
    return await fn();
  } finally {
    ctx.handBusy = false;
  }
}

export function grab(ctx, target, opts = {}) {
  return withHandLock(ctx, () => grabInner(ctx, target, opts));
}

async function grabInner(ctx, target, { signal, step = null, taskId = null } = {}) {
  if (ctx.holding) return blocked(ctx, 'already_holding');
  const mesh = ctx.world.getObject(target);
  if (!mesh) throw new RangeError(`未知物体: ${target}`);
  // 判定只看水平距离，不含高度差；不满足先走过去再判一次。
  if (hdist(ctx.robot.pos, ctx.world.worldPos(target)) >= GRAB_RADIUS) {
    const r = await go(ctx, target, { signal, step, taskId });
    if (!r.ok) return r;
    if (hdist(ctx.robot.pos, ctx.world.worldPos(target)) >= GRAB_RADIUS) return blocked(ctx, 'too_far');
  }
  const p = ctx.world.worldPos(target);
  await turnTo({ robot: ctx.robot, ticker: ctx.ticker, signal, yaw: yawToward(p[0] - ctx.robot.pos[0], p[2] - ctx.robot.pos[2]), bus: ctx.bus });
  ctx.sm.moveTo('picking', { step, taskId });
  attachKeepWorld(ctx.robot.carryAnchor, mesh); // 保持世界变换，不瞬移
  ctx.holding = target;
  const from = mesh.position.clone();
  const s0 = mesh.scale.x;
  await tween(ctx, signal, ACTION_MAX_SECONDS, (k) => {
    mesh.position.lerpVectors(from, ZERO, k);
    mesh.scale.setScalar(s0 + (CARRY_SCALE - s0) * k);
  });
  mesh.position.copy(ZERO);
  mesh.scale.setScalar(CARRY_SCALE);
  ctx.bus.emit('robot:holding', { objectId: target });
  return { ok: true };
}

/** 在家具台面上挑一个离机器人最近、且不压住别的物体的落点（世界 x,z）。 */
export function pickDropSpot(world, furnitureGroup, mesh, robotXZ) {
  const [x0, z0, x1, z1] = furnitureGroup.userData.box;
  const inset = Math.min(0.1, (x1 - x0) / 2, (z1 - z0) / 2);
  const others = [...world.objects.values()]
    .filter((m) => m !== mesh && m.parent === furnitureGroup)
    .map((m) => { const v = new THREE.Vector3(); m.getWorldPosition(v); return [v.x, v.z]; });
  const cands = [];
  for (let x = x0 + inset; x <= x1 - inset + 1e-9; x += 0.1) {
    for (let z = z0 + inset; z <= z1 - inset + 1e-9; z += 0.1) {
      const clear = Math.min(Infinity, ...others.map(([ox, oz]) => Math.hypot(ox - x, oz - z)));
      cands.push({ x, z, clear, d: Math.hypot(x - robotXZ[0], z - robotXZ[1]) });
    }
  }
  cands.sort((a, b) => a.d - b.d || a.x - b.x || a.z - b.z);
  const ok = cands.find((c) => c.clear >= 0.16);
  const best = ok ?? [...cands].sort((a, b) => b.clear - a.clear || a.d - b.d)[0];
  return [best.x, best.z];
}

export function drop(ctx, target, to, opts = {}) {
  return withHandLock(ctx, () => dropInner(ctx, target, to, opts));
}

async function dropInner(ctx, target, to, { signal, step = null, taskId = null } = {}) {
  if (ctx.holding !== target) return blocked(ctx, 'not_holding');
  const fg = ctx.world.getFurniture(to);
  if (!fg) throw new RangeError(`未知家具: ${to}`);
  if (!fg.userData.surface) return blocked(ctx, 'no_surface');
  const mesh = ctx.world.getObject(target);
  const r = await go(ctx, to, { signal, step, taskId });
  if (!r.ok) return r;
  const [rx, , rz] = ctx.robot.pos;
  if (distToBox(rx, rz, fg.userData.box) >= GRAB_RADIUS) return blocked(ctx, 'too_far');
  const [wx, wz] = pickDropSpot(ctx.world, fg, mesh, [rx, rz]);
  await turnTo({ robot: ctx.robot, ticker: ctx.ticker, signal, yaw: yawToward(wx - rx, wz - rz), bus: ctx.bus });
  ctx.sm.moveTo('placing', { step, taskId });
  attachKeepWorld(fg, mesh);
  const from = mesh.position.clone();
  const to3 = new THREE.Vector3(wx - fg.position.x, fg.userData.top - fg.position.y + mesh.userData.halfH, wz - fg.position.z);
  const s0 = mesh.scale.x;
  await tween(ctx, signal, ACTION_MAX_SECONDS, (k) => {
    mesh.position.lerpVectors(from, to3, k);
    mesh.scale.setScalar(s0 + (1 - s0) * k);
  });
  settleOnSurface(fg, mesh, wx, wz);
  ctx.holding = null;
  ctx.bus.emit('robot:holding', { objectId: null });
  if (ctx.memory.enabled) ctx.memory.upsert([{ id: target, room: ctx.world.roomOf(target), pos: ctx.world.worldPos(target) }]);
  return { ok: true };
}

const confuse = async (ctx, signal, step, taskId) => {
  ctx.sm.moveTo('confused', { step, taskId });
  await ctx.ticker.wait(CONFUSED_SECONDS, signal);
};

/** 先查记忆直达，落空则按"当前分区优先、其余按到扫描点距离升序"扫描。 */
export async function find(ctx, target, { signal, step = null, taskId = null } = {}) {
  const opts = { signal, step, taskId };
  if (ctx.holding === target) return { ok: true, room: robotRoom(ctx) };
  const mem = ctx.memory.enabled ? ctx.memory.get(target) : null;
  if (mem && mem.confidence >= MEMORY.MIN_USABLE) {
    const r = await go(ctx, target, opts);
    if (!r.ok) return r;
    const { seen } = await observe(ctx, mem.room, opts);
    if (seen.some((s) => s.id === target)) {
      ctx.memory.hit(target);
      return { ok: true, room: mem.room, via: 'memory' };
    }
    ctx.memory.miss(target);
    await confuse(ctx, signal, step, taskId);
  }
  const here = robotRoom(ctx);
  const rooms = [...ctx.layout.rooms].sort((a, b) => {
    if (a.id === here) return -1;
    if (b.id === here) return 1;
    const da = hdist(ctx.robot.pos, [a.scan_point[0], 0, a.scan_point[2]]);
    const db = hdist(ctx.robot.pos, [b.scan_point[0], 0, b.scan_point[2]]);
    return da - db;
  });
  for (const room of rooms) {
    const r = await go(ctx, room.id, opts);
    if (!r.ok) return r;
    const { seen } = await observe(ctx, room.id, opts);
    if (seen.some((s) => s.id === target)) {
      const g = await go(ctx, target, opts);
      if (!g.ok) return g;
      return { ok: true, room: room.id, via: 'scan' };
    }
  }
  return blocked(ctx, 'not_found');
}

export const ACTIONS = Object.freeze({
  find: (ctx, s, o) => find(ctx, s.target, o),
  go: (ctx, s, o) => go(ctx, s.target, o),
  grab: (ctx, s, o) => grab(ctx, s.target, o),
  drop: (ctx, s, o) => drop(ctx, s.target, s.to, o),
  observe: (ctx, s, o) => observe(ctx, s.room ?? null, o),
});
