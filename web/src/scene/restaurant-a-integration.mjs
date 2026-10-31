// Opt-in integration check: run in a checkout containing A PR #20 and B PR #23.
// Uses A's real executor, queue, clock, actions and navigation without mocks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { createRestaurantScene } from './restaurant-scene.js';
import { createEventBus } from '../core/eventbus.js';
import { createStateMachine } from '../core/statemachine.js';
import { createTicker } from '../core/ticker.js';
import { createTaskQueue } from '../core/taskqueue.js';
import { createLocalMemory } from '../core/memory.js';
import { drive } from '../core/sim.js';
import { createRobot } from '../robot/robot.js';
import { createExecutor } from '../robot/executor.js';
import { buildGrid, planRoute, nearestWalkable } from '../nav/route.js';
import { cellCenter, worldToCell, reachableCells, ROBOT_RADIUS, GRAB_RADIUS } from '../nav/grid.js';

const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const layout = read('../../public/layouts/layout_restaurant.json');
const semantics = read('../../public/scene-data/restaurant_semantics.json');
const config = read('../../public/scene-data/restaurant_scene_config.json');
const hd = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const boxOf = f => [f.pos[0], f.pos[2], f.pos[0] + f.size[0], f.pos[2] + f.size[2]];
function inside(point, polygon) {
 const crosses = polygon.map((a, i) => {
  const b = polygon[(i + 1) % polygon.length];
  return (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
 });
 return crosses.every(n => n >= -1e-6) || crosses.every(n => n <= 1e-6);
}
function collisionAt(pos) {
 return layout.furniture.filter(f => f.blocks).filter(f => {
  const [x0, z0, x1, z1] = boxOf(f);
  return pos[0] > x0 - ROBOT_RADIUS + 1e-7 && pos[0] < x1 + ROBOT_RADIUS - 1e-7 &&
         pos[2] > z0 - ROBOT_RADIUS + 1e-7 && pos[2] < z1 + ROBOT_RADIUS - 1e-7;
 }).map(f => f.id);
}
function segmentIntersectsProxy(a,b,f) {
 const box=boxOf(f).map((n,i)=>n+(i<2?-ROBOT_RADIUS:ROBOT_RADIUS));
 let lo=0,hi=1;
 for(let k=0;k<2;k++) {
  const p=a[k*2], d=b[k*2]-p;
  if(Math.abs(d)<1e-12) { if(p<=box[k]+1e-7||p>=box[k+2]-1e-7)return false; continue; }
  let u=(box[k]+1e-7-p)/d,v=(box[k+2]-1e-7-p)/d;
  if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);
  if(lo>=hi-1e-10)return false;
 }
 return lo<hi-1e-10;
}
function context() {
 const world = createRestaurantScene({ THREE, layout, semantics });
 const ticker = createTicker(), bus = createEventBus({ now: () => ticker.time * 1000 });
 const robot = createRobot({ root: new THREE.Group() }); // A's real pose/carry anchor; no GLB or renderer in Node.
 const scan = layout.rooms[0].scan_point;
 robot.setPose(scan[0], scan[2], 0);
 world.root.add(robot.group);
 const ctx = { world, layout, ticker, bus, robot, grid: buildGrid(layout), sm: createStateMachine({ bus }),
  memory: createLocalMemory({ bus, enabled: false }), holding: null, handBusy: false, options: {} };
 ctx.executor = createExecutor(ctx, createTaskQueue());
 return ctx;
}
const report = {
 kind: 'actual-A-executor-with-B-restaurant-adapter', generated_at: new Date().toISOString(),
 references: { A_PR: 20, A_sha: '1499b6a420219c9788e2cc8eac0384464de78edb', B_base_PR: 23,
  B_base_sha: 'a65f0531cf238e7a7bc5a2e7668e0268a1791196', three_revision: THREE.REVISION,
  scene_ply_sha256: config.asset.sha256 },
 scope: 'Real A executor/navigation against restaurant JSON and B Object3D proxies. Node has no Gaussian renderer, GLB, HTTP backend or measured hardware FPS. Real PLY rendering is a separate browser evidence item.',
 objects: [], cross_furniture: [],
};
const ctx = context(), { world, grid } = ctx;
assert.equal(world.furniture.size, 63);
assert.equal(world.objects.size, 8);
assert.equal(world.objectsInRoom('restaurant').length, 8);
assert.equal(world.getObject('missing'), undefined);
assert.equal(world.getFurniture('missing'), undefined);
for (const id of semantics.navigation_proxy_ids) assert.equal(world.getFurniture(id), undefined);
// Actual Mesh bounds must match layout, not just copied metadata.
let proxyBoundsChecked = 0;
for (const f of layout.furniture) {
 const mesh = world.getObjectById(f.id);
 const bounds = new THREE.Box3().setFromObject(mesh);
 [bounds.min.x, bounds.min.y, bounds.min.z].forEach((n, k) => near(n, f.pos[k]));
 [bounds.max.x, bounds.max.y, bounds.max.z].forEach((n, k) => near(n, f.pos[k] + f.size[k]));
 assert.equal(mesh.material.visible, false);
 if (f.blocks) proxyBoundsChecked++;
 if (world.getFurniture(f.id)) {
  const g = world.getFurniture(f.id);
  assert.deepEqual(g.userData.box, boxOf(f));
  near(g.userData.top, f.pos[1] + f.size[1]);
  assert.equal(g.userData.surface, f.surface);
 }
}
// roomOf must follow an attached object's current world position, not its original room string.
const cup = world.getObject('cup_red'), parent = new THREE.Group();
world.root.add(parent);
parent.attach(cup); parent.position.x += 100;
assert.equal(world.roomOf('cup_red'), null);
assert.ok(!world.objectsInRoom('restaurant').includes('cup_red'));
world.dispose();
report.registry = { furniture: 63, task_objects: 8, actual_proxy_mesh_bounds_checked: proxyBoundsChecked, dynamic_room_query: 'passed' };

async function scenario(objectDef, destination) {
 const ctx = context(), { world, robot, ticker } = ctx;
 const scan = layout.rooms[0].scan_point;
 const reach = reachableCells(layout, worldToCell(layout, scan[0], scan[2]), ctx.grid.blocked);
 const nearCell = nearestWalkable(ctx.grid, objectDef.pos[0], objectDef.pos[2], { reach });
 assert.ok(nearCell);
 const stand = cellCenter(layout, ...nearCell.cell);
 assert.ok(nearCell.dist < GRAB_RADIUS);
 const route = planRoute(ctx.grid, [scan[0], scan[2]], [objectDef.pos[0], objectDef.pos[2]]);
 assert.ok(route);
 const object = world.getObject(objectDef.id), attachments = [], frames = [];
 for (const target of [robot.carryAnchor, world.getFurniture(destination)]) {
  const original = target.attach;
  target.attach = function(child) {
   const before = child.getWorldPosition(new THREE.Vector3());
   const value = original.call(this, child);
   const after = child.getWorldPosition(new THREE.Vector3());
   attachments.push({ parent: this.name, error_m: before.distanceTo(after) });
   assert.ok(before.distanceTo(after) < 1e-6);
   return value;
  };
 }
 ctx.bus.on('task:step', e => {
  if (e.action === 'grab' && e.ok) {
   assert.equal(object.parent, robot.carryAnchor);
   assert.equal(ctx.holding, objectDef.id);
  }
 });
 let maxCollisionCount = 0, continuousCrossings = 0, previous = [...robot.pos];
 const result = await drive(ticker, ctx.executor.submitPlan({ source: 'script', steps: [
  { action: 'find', target: objectDef.id }, { action: 'grab', target: objectDef.id },
  { action: 'drop', target: objectDef.id, to: destination },
 ] }), { maxSeconds: 600, onFrame() {
  maxCollisionCount = Math.max(maxCollisionCount, collisionAt(robot.pos).length);
  continuousCrossings += layout.furniture.filter(f=>f.blocks&&segmentIntersectsProxy(previous,robot.pos,f)).length;
  previous = [...robot.pos];
  frames.push([...robot.pos]);
 } });
 assert.equal(result.ok, true, JSON.stringify({ object: objectDef.id, result }));
 assert.equal(result.steps, 3);
 assert.equal(ctx.holding, null);
 assert.equal(object.parent, world.getFurniture(destination));
 const pos = world.worldPos(objectDef.id), fg = world.getFurniture(destination);
 near(pos[1] - object.userData.halfH, fg.userData.top);
 assert.equal(object.scale.x, 1);
 assert.equal(world.roomOf(objectDef.id), 'restaurant');
 assert.equal(maxCollisionCount, 0, 'A navigation intersects real expanded proxy');
 assert.equal(continuousCrossings,0,'A movement segment crosses expanded proxy');
 const steps = ctx.bus.log.filter(e => e.name === 'task:step').map(e => e.payload);
 assert.deepEqual(steps.map(e => [e.action, e.ok]), [['find', true], ['grab', true], ['drop', true]]);
 const onTrueFootprint = inside([pos[0], pos[2]], fg.userData.surfacePolygon);
 assert.equal(onTrueFootprint, true, 'A dropped object center outside the real four-point surface');
 const evidence = { object_id: objectDef.id, initial_surface: objectDef.on, destination,
  nearest_reachable_stand_cell: nearCell.cell, nearest_stand_world_xz: stand,
  nearest_stand_distance_m: nearCell.dist, route_goal_cell: route.goalCell,
  steps, attachments, final_world_center: pos, final_contact_y: pos[1] - object.userData.halfH,
  drop_inside_true_surface_polygon: onTrueFootprint, sampled_frames: frames.length,
  sampled_frames_intersecting_inflated_proxy: maxCollisionCount, continuous_proxy_crossings: continuousCrossings, simulated_seconds: ticker.time };
 world.dispose();
 return evidence;
}
for (const o of layout.objects) report.objects.push(await scenario(o, o.on));
report.cross_furniture.push(await scenario(layout.objects.find(o => o.id === 'cup_red'), 'table_03'));
report.actual_A_drop_polygon_failures = [...report.objects, ...report.cross_furniture].filter(o => !o.drop_inside_true_surface_polygon).map(o => ({ id: o.object_id, destination: o.destination }));
report.status = report.actual_A_drop_polygon_failures.length ? 'adapter-and-A-actions-pass-placement-contract-gap' : 'passed';
const output = process.argv[2];
if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, registry: report.registry, runs: report.objects.length + report.cross_furniture.length, polygon_failures: report.actual_A_drop_polygon_failures }));
