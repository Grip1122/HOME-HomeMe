import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createSimContext } from './testkit.js';
import { grab, drop, find, attachKeepWorld } from './actions.js';
import { drive } from '../core/sim.js';
import { GRAB_RADIUS, CARRY_SCALE } from '../core/config.js';

const layout = JSON.parse(readFileSync(new URL('../../public/layouts/layout_A.json', import.meta.url), 'utf-8'));
const wp = (ctx, id) => ctx.world.worldPos(id);
const hd = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const states = (ctx) => ctx.bus.log.filter((e) => e.name === 'robot:state').map((e) => e.payload.to);

/** 把物体挪到某家具台面中心（attach 保持世界变换后再设位置），模拟"被人拿走"。 */
function moveObject(ctx, id, furnitureId) {
  const fg = ctx.world.getFurniture(furnitureId);
  const m = ctx.world.getObject(id);
  attachKeepWorld(fg, m);
  m.position.set(0, fg.userData.top - fg.position.y + m.userData.halfH, 0);
  ctx.world.root.updateMatrixWorld(true);
}

describe('2.1 抓取：五条必测', () => {
  it('距离 0.9 米抓取成功，原地不走动，物体缩到 0.4 倍挂在携带锚点', async () => {
    const cup = [-3.0, 0, 2.85];
    const ctx = createSimContext(layout, { start: [cup[0] + 0.9, cup[2]] }); // 餐桌右侧外 0.2 米，可通行
    const before = [...ctx.robot.pos];
    expect(hd(before, wp(ctx, 'cup_red'))).toBeCloseTo(0.9, 6);
    const r = await drive(ctx.ticker, grab(ctx, 'cup_red'));
    expect(r.ok).toBe(true);
    expect(ctx.robot.pos[0]).toBeCloseTo(before[0], 9);
    expect(ctx.robot.pos[2]).toBeCloseTo(before[2], 9);
    const m = ctx.world.getObject('cup_red');
    expect(m.parent).toBe(ctx.robot.carryAnchor);
    expect(m.scale.x).toBeCloseTo(CARRY_SCALE, 9);
    expect(ctx.holding).toBe('cup_red');
    // 状态表里 picking 只能从 walking 进入，所以状态序列会经过 walking；关键是没有发生位移
    const moved = ctx.bus.log.filter((e) => e.name === 'robot:moved').map((e) => e.payload.pos);
    for (const p of moved) expect(hd(p, before)).toBeLessThan(1e-9);
  });

  it('距离 1.1 米且走不近（物体在床正中）返回 too_far，物体不动', async () => {
    const ctx = createSimContext(layout, { start: [4.6, -2.25] });
    moveObject(ctx, 'notebook_orange', 'bed'); // 床中心 (4.6, -3.5)，最近可通行格离它 ≥1.25 米
    const objBefore = wp(ctx, 'notebook_orange');
    ctx.robot.setPose(objBefore[0], objBefore[2] + 1.1, 0);
    expect(hd(ctx.robot.pos, objBefore)).toBeCloseTo(1.1, 6);
    expect(hd(ctx.robot.pos, objBefore)).toBeGreaterThanOrEqual(GRAB_RADIUS);
    const r = await drive(ctx.ticker, grab(ctx, 'notebook_orange'));
    expect(r).toEqual({ ok: false, reason: 'too_far' });
    const objAfter = wp(ctx, 'notebook_orange');
    for (let i = 0; i < 3; i++) expect(Math.abs(objAfter[i] - objBefore[i])).toBe(0);
    expect(ctx.world.getObject('notebook_orange').parent).toBe(ctx.world.getFurniture('bed'));
    expect(ctx.holding).toBe(null);
    expect(ctx.bus.log.some((e) => e.name === 'robot:blocked' && e.payload.reason === 'too_far')).toBe(true);
  });

  it('挂载前后物体世界坐标差 < 1e-6（机器人有平移与旋转）', () => {
    const ctx = createSimContext(layout, { start: [-2.1, 2.85] });
    ctx.robot.setPose(-2.1, 2.85, 1.234);
    ctx.world.root.updateMatrixWorld(true);
    const m = ctx.world.getObject('cup_red');
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    m.getWorldPosition(a);
    attachKeepWorld(ctx.robot.carryAnchor, m);
    m.updateWorldMatrix(true, false);
    m.getWorldPosition(b);
    expect(a.distanceTo(b)).toBeLessThan(1e-6);
    // 反向挂回家具同样不跳
    attachKeepWorld(ctx.world.getFurniture('table_dining'), m);
    m.updateWorldMatrix(true, false);
    m.getWorldPosition(b);
    expect(a.distanceTo(b)).toBeLessThan(1e-6);
  });

  it('真实 grab 流程里挂到锚点那一刻物体不跳（世界坐标差 < 1e-6）', async () => {
    const ctx = createSimContext(layout, { start: [-2.1, 2.85] });
    const m = ctx.world.getObject('cup_red');
    const jumps = [];
    const anchor = ctx.robot.carryAnchor;
    const origAttach = anchor.attach.bind(anchor);
    const origAdd = anchor.add.bind(anchor);
    const spy = (orig) => (o) => {
      const a = new THREE.Vector3(); const b = new THREE.Vector3();
      o.updateWorldMatrix(true, false); o.getWorldPosition(a);
      const r = orig(o);
      o.updateWorldMatrix(true, false); o.getWorldPosition(b);
      jumps.push(a.distanceTo(b));
      return r;
    };
    anchor.attach = spy(origAttach);
    anchor.add = spy(origAdd);
    expect((await drive(ctx.ticker, grab(ctx, 'cup_red'))).ok).toBe(true);
    expect(m.parent).toBe(anchor);
    expect(jumps.length).toBeGreaterThan(0);
    for (const j of jumps) expect(j).toBeLessThan(1e-6);
  });

  it('抓取中途再次调用被拒绝，不产生第二次挂载', async () => {
    const ctx = createSimContext(layout, { start: [-2.1, 2.85] });
    let attaches = 0;
    const orig = ctx.robot.carryAnchor.attach.bind(ctx.robot.carryAnchor);
    ctx.robot.carryAnchor.attach = (o) => { attaches++; return orig(o); };
    const p1 = grab(ctx, 'cup_red');
    const p2 = grab(ctx, 'bottle_green');
    const [r1, r2] = await drive(ctx.ticker, Promise.all([p1, p2]));
    expect(r1.ok).toBe(true);
    expect(r2).toEqual({ ok: false, reason: 'busy' });
    expect(attaches).toBe(1);
    expect(ctx.world.getObject('bottle_green').parent).toBe(ctx.world.getFurniture('table_dining'));
  });

  it('动画中途抛错后锁仍被释放，下一次抓取能进入', async () => {
    const ctx = createSimContext(layout, { start: [-2.1, 2.85] });
    const m = ctx.world.getObject('cup_red');
    const orig = m.position.lerpVectors.bind(m.position);
    let n = 0;
    m.position.lerpVectors = (...a) => { if (++n === 3) throw new Error('动画炸了'); return orig(...a); };
    await expect(drive(ctx.ticker, grab(ctx, 'cup_red'))).rejects.toThrow('动画炸了');
    expect(ctx.handBusy).toBe(false);
    ctx.holding = null;
    const r = await drive(ctx.ticker, grab(ctx, 'bottle_green'));
    expect(r.ok).toBe(true);
  });
});

describe('2.1 放置与执行器', () => {
  it('执行"抓杯子→放到书桌"步骤数组：自动完成，贴台面、缩放回 1，机器人从不进入家具', async () => {
    const ctx = createSimContext(layout, { start: [-1.5, 0] });
    let inside = 0;
    const onFrame = () => {
      const [x, , z] = ctx.robot.pos;
      for (const f of ctx.world.furniture.values()) {
        const [x0, z0, x1, z1] = f.userData.box;
        if (x > x0 && x < x1 && z > z0 && z < z1) inside++;
      }
    };
    const plan = { source: 'script', steps: [{ action: 'grab', target: 'cup_red' }, { action: 'drop', target: 'cup_red', to: 'desk' }] };
    const r = await drive(ctx.ticker, ctx.executor.submitPlan(plan, { query: '把水杯放到书房' }), { onFrame });
    expect(r.ok).toBe(true);
    expect(inside).toBe(0);
    const m = ctx.world.getObject('cup_red');
    const desk = ctx.world.getFurniture('desk');
    expect(m.parent).toBe(desk);
    expect(m.scale.x).toBe(1);
    expect(wp(ctx, 'cup_red')[1]).toBeCloseTo(desk.userData.top + m.userData.halfH, 6);
    expect(ctx.world.roomOf('cup_red')).toBe('study');
    expect(ctx.sm.state).toBe('idle');
    const names = ctx.bus.log.map((e) => e.name);
    expect(names.filter((n) => n === 'task:step')).toHaveLength(2);
    expect(names.at(-1)).toBe('task:end');
    expect(states(ctx)).toContain('celebrating');
  });

  it('没拿着就放置返回 not_holding；放到非台面家具返回 no_surface', async () => {
    const ctx = createSimContext(layout, { start: [-2.1, 2.85] });
    expect(await drive(ctx.ticker, drop(ctx, 'cup_red', 'desk'))).toEqual({ ok: false, reason: 'not_holding' });
    await drive(ctx.ticker, grab(ctx, 'cup_red'));
    expect(await drive(ctx.ticker, drop(ctx, 'cup_red', 'sofa'))).toEqual({ ok: false, reason: 'no_surface' });
  });

  it('执行器忙时再提交被拒绝', async () => {
    const ctx = createSimContext(layout);
    const p1 = ctx.executor.submitPlan({ steps: [{ action: 'go', target: 'study' }] });
    const r2 = await ctx.executor.submitPlan({ steps: [{ action: 'go', target: 'bedroom' }] });
    expect(r2).toEqual({ ok: false, reason: 'busy' });
    expect((await drive(ctx.ticker, p1)).ok).toBe(true);
  });
});

describe('2.2 查找策略：三条验收', () => {
  const visited = (ctx) => ctx.bus.log.filter((e) => e.name === 'robot:state' && e.payload.to === 'scanning').length;

  it('记忆关闭：从书房出发找水杯，走完三个分区（书房→卧室→客厅）', async () => {
    const ctx = createSimContext(layout, { start: [3.0, 2.0], memoryEnabled: false, observeSeconds: 0.8 });
    const r = await drive(ctx.ticker, find(ctx, 'cup_red'));
    expect(r).toMatchObject({ ok: true, room: 'living', via: 'scan' });
    expect(visited(ctx)).toBe(3);
    expect(hd(ctx.robot.pos, wp(ctx, 'cup_red'))).toBeLessThan(GRAB_RADIUS);
  });

  it('当前分区优先：人在客厅但离卧室扫描点更近，仍先扫客厅', async () => {
    const start = [-0.3, -4.0];
    const ctx = createSimContext(layout, { start, memoryEnabled: false, observeSeconds: 0.8 });
    const d = (r) => hd([start[0], 0, start[1]], layout.rooms.find((x) => x.id === r).scan_point);
    expect(d('bedroom')).toBeLessThan(d('living')); // 前提：如果只按距离排，会先去卧室
    const r = await drive(ctx.ticker, find(ctx, 'keys_yellow'));
    expect(r).toMatchObject({ ok: true, room: 'living' });
    expect(visited(ctx)).toBe(1);
  });

  it('记忆开启：直达，只观察一次', async () => {
    const ctx = createSimContext(layout, { start: [3.0, 2.0], observeSeconds: 0.8 });
    ctx.memory.upsert([{ id: 'cup_red', room: 'living', pos: wp(ctx, 'cup_red') }]);
    const r = await drive(ctx.ticker, find(ctx, 'cup_red'));
    expect(r).toMatchObject({ ok: true, via: 'memory' });
    expect(visited(ctx)).toBe(1);
    expect(ctx.memory.get('cup_red').confidence).toBeCloseTo(0.85, 9);
  });

  it('杯子被拿到书房：先扑空、困惑、再扫到，记忆置信度先降后刷新', async () => {
    const ctx = createSimContext(layout, { start: [-1.5, 0], observeSeconds: 0.8 });
    ctx.memory.upsert([{ id: 'cup_red', room: 'living', pos: wp(ctx, 'cup_red') }]);
    const memPos = wp(ctx, 'cup_red');
    moveObject(ctx, 'cup_red', 'desk');
    // 第一次环顾时机器人应站在"记忆位置"附近（餐桌旁），而不是杯子的真实位置（书房书桌）
    let firstScanAt = null;
    ctx.bus.on('robot:state', ({ to }) => { if (to === 'scanning' && !firstScanAt) firstScanAt = [...ctx.robot.pos]; });
    const r = await drive(ctx.ticker, find(ctx, 'cup_red'));
    expect(hd(firstScanAt, memPos)).toBeLessThan(GRAB_RADIUS);
    expect(hd(firstScanAt, wp(ctx, 'cup_red'))).toBeGreaterThan(3);
    expect(r).toMatchObject({ ok: true, room: 'study', via: 'scan' });
    const seq = states(ctx);
    expect(seq.indexOf('confused')).toBeGreaterThan(-1);
    expect(seq.indexOf('confused')).toBeLessThan(seq.lastIndexOf('scanning'));
    expect(ctx.bus.log.some((e) => e.name === 'memory:miss')).toBe(true);
    expect(ctx.memory.get('cup_red')).toMatchObject({ room: 'study', confidence: 0.8, status: 'fresh' });
  });
});
