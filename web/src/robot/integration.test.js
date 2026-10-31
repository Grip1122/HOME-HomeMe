// A+B 集成：执行器只依赖 world 端口；以"外部场景提供方"的方式注入，跑 find → grab → drop 真实链路。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createSimContext } from './testkit.js';
import { buildWorld } from './world.js';
import { createWorldPort, assertWorldPort } from './world-port.js';
import { drive } from '../core/sim.js';
import { distToBox } from '../nav/route.js';

const layout = JSON.parse(readFileSync(new URL('../../public/layouts/layout_A.json', import.meta.url), 'utf-8'));

/** 模拟设计 B 交付：只给 WorldSource（root/layout/furniture/objects），查询方法由端口补齐。 */
function sceneFromProvider() {
  const w = buildWorld(layout);
  return createWorldPort({ root: w.root, layout, furniture: w.furniture, objects: w.objects });
}

const chain = (to) => ({
  source: 'script',
  steps: [
    { action: 'find', target: 'cup_red' },
    { action: 'grab', target: 'cup_red' },
    { action: 'drop', target: 'cup_red', to },
  ],
});
const events = (ctx, name) => ctx.bus.log.filter((e) => e.name === name).map((e) => e.payload);

describe('world 端口', () => {
  it('外部场景提供方满足端口，且 id 查询一致', () => {
    const w = assertWorldPort(sceneFromProvider());
    expect(w.getObject('cup_red').isObject3D).toBe(true);
    expect(w.getFurniture('table_dining').userData).toMatchObject({ surface: true, top: 0.75 });
    expect(w.getFurniture('table_dining').userData.box).toHaveLength(4);
    expect(w.roomOf('cup_red')).toBe('living');
    expect(w.objectsInRoom('living')).toContain('cup_red');
    expect(w.worldPos('cup_red')[1]).toBeCloseTo(0.75 + w.getObject('cup_red').userData.halfH, 6);
  });

  it('缺 box / top / halfH 时给出明确错误', () => {
    const w = sceneFromProvider();
    delete w.getFurniture('desk').userData.top;
    delete w.getObject('cup_red').userData.halfH;
    expect(() => assertWorldPort(w)).toThrow(/家具 desk 缺 top.*物体 cup_red 缺 halfH/);
  });
});

describe('find(cup_red) → grab(cup_red) → drop(cup_red, table_coffee)', () => {
  it('(a) 全程不穿阻挡家具；(b) 抓取前后世界坐标误差 < 1e-6；(c) 放下后在台面高度', async () => {
    const ctx = createSimContext(layout, { world: sceneFromProvider(), start: [-1.5, 0] });
    const cup = ctx.world.getObject('cup_red');
    const table = ctx.world.getFurniture('table_coffee');

    let grabErr = null;
    const anchor = ctx.robot.carryAnchor;
    const attach = anchor.attach.bind(anchor);
    anchor.attach = (obj) => {
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      obj.updateWorldMatrix(true, false);
      obj.getWorldPosition(a);
      const r = attach(obj);
      obj.updateWorldMatrix(true, false);
      obj.getWorldPosition(b);
      grabErr = a.distanceTo(b);
      return r;
    };

    const r = await drive(ctx.ticker, ctx.executor.submitPlan(chain('table_coffee')));
    expect(r.ok).toBe(true);

    const blockers = layout.furniture.filter((f) => f.blocks).map((f) => ctx.world.getFurniture(f.id).userData.box);
    const path = events(ctx, 'robot:moved').map((e) => e.pos);
    expect(path.length).toBeGreaterThan(10);
    for (const [x, , z] of path) {
      for (const box of blockers) expect(distToBox(x, z, box)).toBeGreaterThan(1e-6);
    }

    expect(grabErr).not.toBeNull();
    expect(grabErr).toBeLessThan(1e-6);

    expect(cup.parent).toBe(table);
    expect(ctx.holding).toBe(null);
    expect(ctx.world.worldPos('cup_red')[1]).toBeCloseTo(table.userData.top + cup.userData.halfH, 6);
    expect(cup.scale.x).toBeCloseTo(1, 9);
    const [x0, z0, x1, z1] = table.userData.box;
    const [wx, , wz] = ctx.world.worldPos('cup_red');
    expect(wx >= x0 && wx <= x1 && wz >= z0 && wz <= z1).toBe(true);

    expect(events(ctx, 'task:end')).toEqual([{ taskId: expect.any(String), ok: true, steps: 3, durationMs: expect.any(Number), corrected: false }]);
  });

  it('(d) 目标不是台面：返回失败并发 task:end ok=false，杯子仍在手上', async () => {
    const ctx = createSimContext(layout, { world: sceneFromProvider() });
    const r = await drive(ctx.ticker, ctx.executor.submitPlan(chain('sofa')));
    expect(r).toMatchObject({ ok: false, reason: 'no_surface' });
    const [end] = events(ctx, 'task:end');
    expect(end).toMatchObject({ ok: false, steps: 3 });
    expect(ctx.holding).toBe('cup_red');
  });

  it('(d) 目标家具不存在（table_x）：执行器抛错，但仍发 task:end ok=false', async () => {
    const ctx = createSimContext(layout, { world: sceneFromProvider() });
    await expect(drive(ctx.ticker, ctx.executor.submitPlan(chain('table_x')))).rejects.toThrow('未知家具: table_x');
    const [end] = events(ctx, 'task:end');
    expect(end).toMatchObject({ ok: false, steps: 2 });
    expect(ctx.handBusy).toBe(false);
  });

  it('(d) 物体找不到：find 返回 not_found，task:end ok=false', async () => {
    const world = sceneFromProvider();
    world.objects.get('cup_red').parent.remove(world.objects.get('cup_red'));
    world.objects.delete('cup_red');
    const ctx = createSimContext(layout, { world });
    const r = await drive(ctx.ticker, ctx.executor.submitPlan({ source: 'script', steps: [{ action: 'find', target: 'cup_red' }] }));
    expect(r).toMatchObject({ ok: false, reason: 'not_found' });
    expect(events(ctx, 'task:end')[0]).toMatchObject({ ok: false, steps: 1 });
  });
});
