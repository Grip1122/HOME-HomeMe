// 行走：沿路径点逐段"先转身、再前进"，速度 WALK_SPEED。返回 Promise，支持中途取消。
// 只改机器人的位姿，不碰状态机（状态由 actions.js 在调用前后切换）。
import { WALK_SPEED, TURN_SPEED } from '../core/config.js';

const TAU = Math.PI * 2;
/** 把角度差规整到 (-π, π]，转身永远走短弧。 */
export function shortestAngle(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** 朝 +z 为 yaw=0，绕 y 轴右手系：朝向向量 (dx,dz) 的 yaw = atan2(dx, dz)。 */
export const yawToward = (dx, dz) => Math.atan2(dx, dz);

/** 原地转到 yaw（走短弧）。 */
export async function turnTo({ robot, ticker, signal, yaw, turnSpeed = TURN_SPEED, bus = null }) {
  let diff = shortestAngle(robot.yaw, yaw);
  if (Math.abs(diff) < 1e-9) return;
  await ticker.until((dt) => {
    const step = Math.min(Math.abs(diff), turnSpeed * dt);
    const s = Math.sign(diff) * step;
    robot.setPose(robot.pos[0], robot.pos[2], robot.yaw + s);
    diff -= s;
    if (bus) bus.emit('robot:moved', { pos: robot.pos, yaw: robot.yaw });
    return Math.abs(diff) < 1e-9;
  }, signal);
  robot.setPose(robot.pos[0], robot.pos[2], yaw);
}

/**
 * robot 需要：pos/yaw 读写、setPose(x,z,yaw)。bus 可选，派发 robot:moved（总线自己节流）。
 * 完成返回 {ok:true}；被取消时抛 AbortError，机器人停在当前位置。
 */
export async function walkPath({ robot, ticker, bus = null, points, signal, speed = WALK_SPEED, turnSpeed = TURN_SPEED }) {
  for (const [tx, tz] of points) {
    const [sx, , sz] = robot.pos;
    const dx = tx - sx;
    const dz = tz - sz;
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) continue;
    await turnTo({ robot, ticker, signal, yaw: yawToward(dx, dz), turnSpeed, bus });
    let left = len;
    await ticker.until((dt) => {
      const step = Math.min(left, speed * dt);
      robot.setPose(robot.pos[0] + (dx / len) * step, robot.pos[2] + (dz / len) * step, robot.yaw);
      left -= step;
      if (bus) bus.emit('robot:moved', { pos: robot.pos, yaw: robot.yaw });
      return left < 1e-9;
    }, signal);
    robot.setPose(tx, tz, robot.yaw); // 落到精确点，消除累计误差
  }
  return { ok: true };
}
