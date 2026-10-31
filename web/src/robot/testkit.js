// 测试与录屏共用的上下文工厂：不依赖浏览器、不加载 glb，机器人用空 Group 代替。
import * as THREE from 'three';
import { createEventBus } from '../core/eventbus.js';
import { createStateMachine } from '../core/statemachine.js';
import { createTicker } from '../core/ticker.js';
import { createTaskQueue } from '../core/taskqueue.js';
import { createLocalMemory } from '../core/memory.js';
import { buildGrid } from '../nav/route.js';
import { buildWorld } from './world.js';
import { createRobot } from './robot.js';
import { createExecutor } from './executor.js';

export function createSimContext(layout, { robot = null, start = [-1.5, 0], memoryEnabled = true, observeSeconds } = {}) {
  const ticker = createTicker();
  const bus = createEventBus({ now: () => ticker.time * 1000 });
  const sm = createStateMachine({ bus });
  const world = buildWorld(layout);
  const bot = robot ?? createRobot({ root: new THREE.Group() });
  bot.setPose(start[0], start[1], 0);
  world.root.add(bot.group);
  world.root.updateMatrixWorld(true);
  const ctx = {
    layout, grid: buildGrid(layout), world, robot: bot, ticker, bus, sm,
    memory: createLocalMemory({ bus, enabled: memoryEnabled }),
    holding: null, handBusy: false,
    options: observeSeconds === undefined ? {} : { observeSeconds },
  };
  ctx.executor = createExecutor(ctx, createTaskQueue());
  return ctx;
}
