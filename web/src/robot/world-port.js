// 统一 world 接口（执行器的端口）。动作与执行器只依赖这里定义的形状，不关心场景是谁建的。
// 场景提供方（buildWorld 的灰盒、设计 B 的高斯泼溅餐厅）只需交出 WorldSource，由 createWorldPort 补齐查询方法。
//
// WorldSource（提供方负责）：
//   root       THREE.Object3D   世界根；机器人 group 会挂在它下面
//   layout     layout.schema.json 的对象，坐标单位米、y 向上
//   furniture  Map<id, Object3D>  userData.box=[x0,z0,x1,z1]（世界 xz）、userData.surface:boolean、userData.top:number（台面世界 y）
//   objects    Map<id, Object3D>  可 attach() 的 Object3D，userData.halfH:number（物体中心到底面的高度）
//
// WorldPort（执行器使用）= WorldSource + getObject / getFurniture / worldPos / objectsInRoom / roomOf。
import * as THREE from 'three';

const tmp = new THREE.Vector3();

export function createWorldPort(source) {
  const { layout, furniture, objects } = source;
  const port = {
    ...source,
    getObject: (id) => objects.get(id),
    getFurniture: (id) => furniture.get(id),
    /** 物体或家具的世界坐标 [x,y,z]；id 不存在时抛 RangeError。 */
    worldPos(id) {
      const m = objects.get(id) ?? furniture.get(id);
      if (!m) throw new RangeError(`未知 id: ${id}`);
      m.updateWorldMatrix(true, false);
      m.getWorldPosition(tmp);
      return [tmp.x, tmp.y, tmp.z];
    },
    /** 以物体当前世界位置所在的格子为准（被抓走后随机器人移动，不再属于原分区）。 */
    roomOf(id) {
      const p = port.worldPos(id);
      const { cell, origin } = layout.grid;
      const c = Math.floor((p[0] - origin[0]) / cell);
      const r = Math.floor((p[2] - origin[2]) / cell);
      for (const room of layout.rooms) {
        const [rc, rr, rw, rh] = room.rect;
        if (c >= rc && c < rc + rw && r >= rr && r < rr + rh) return room.id;
      }
      return null;
    },
    objectsInRoom(roomId) {
      return [...objects.keys()].filter((id) => port.roomOf(id) === roomId);
    },
  };
  return port;
}

/** 校验一个 world 是否满足端口约定；不满足抛 TypeError，信息里带出所有问题。 */
export function assertWorldPort(world) {
  const bad = [];
  for (const k of ['getObject', 'getFurniture', 'worldPos', 'objectsInRoom', 'roomOf']) {
    if (typeof world?.[k] !== 'function') bad.push(`缺方法 ${k}()`);
  }
  if (!world?.root?.isObject3D) bad.push('root 不是 Object3D');
  if (!world?.layout?.rooms) bad.push('缺 layout');
  if (!(world?.furniture instanceof Map) || !(world?.objects instanceof Map)) bad.push('furniture / objects 必须是 Map');
  if (bad.length) throw new TypeError(`world 不满足端口约定：${bad.join('；')}`);
  for (const [id, f] of world.furniture) {
    const { box, surface, top } = f.userData ?? {};
    if (!f.isObject3D) bad.push(`家具 ${id} 不是 Object3D`);
    if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isFinite)) bad.push(`家具 ${id} 缺 box`);
    if (typeof surface !== 'boolean') bad.push(`家具 ${id} 缺 surface`);
    if (!Number.isFinite(top)) bad.push(`家具 ${id} 缺 top`);
  }
  for (const [id, o] of world.objects) {
    if (!o.isObject3D || typeof o.parent?.attach !== 'function') bad.push(`物体 ${id} 不是已挂载、可 attach 的 Object3D`);
    if (!Number.isFinite(o.userData?.halfH)) bad.push(`物体 ${id} 缺 halfH`);
  }
  if (bad.length) throw new TypeError(`world 不满足端口约定：${bad.join('；')}`);
  return world;
}
