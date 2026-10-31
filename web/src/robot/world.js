// 世界：按 layout 建"世界 -> 分区 -> 家具 -> 物体"四层场景图，并提供注册表查询。
// 这里只做演示/测试用的最小实现（家具是隐形包围盒，物体是彩色小几何体）；
// 正式的点云对齐、碰撞层标定属于设计 B（web/src/scene/），届时替换本文件，接口不变。
import * as THREE from 'three';
import { furnitureBox } from '../nav/grid.js';

const COLORS = {
  cup_red: 0xe53935, bottle_green: 0x43a047, remote_black: 0x212121, keys_yellow: 0xfdd835,
  phone_white: 0xf5f5f5, notebook_orange: 0xfb8c00, book_blue: 0x1e88e5, glasses_black: 0x111111,
};

export function buildWorld(layout, { visibleFurniture = true } = {}) {
  const root = new THREE.Group();
  root.name = 'world';
  const rooms = new Map();
  const furniture = new Map();
  const objects = new Map();

  for (const r of layout.rooms) {
    const g = new THREE.Group();
    g.name = `room:${r.id}`;
    root.add(g);
    rooms.set(r.id, g);
  }
  for (const f of layout.furniture) {
    const [w, h, d] = f.size;
    const g = new THREE.Group();
    g.name = `furniture:${f.id}`;
    // 家具组原点放在包围盒底面中心，子物体的局部坐标就是相对台面中心
    g.position.set(f.pos[0] + w / 2, f.pos[1], f.pos[2] + d / 2);
    g.userData = { id: f.id, surface: f.surface, top: f.pos[1] + h, box: furnitureBox(f), kind: 'furniture' };
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ color: 0x9aa7b8, transparent: true, opacity: 0.35 }),
    );
    box.position.y = h / 2;
    box.material.visible = visibleFurniture; // 正式场景里这是隐形碰撞层
    g.add(box);
    rooms.get(f.room).add(g);
    furniture.set(f.id, g);
  }
  for (const o of layout.objects) {
    const mesh = new THREE.Mesh(
      o.id === 'cup_red' || o.id === 'bottle_green'
        ? new THREE.CylinderGeometry(0.07, 0.07, 0.16, 16)
        : new THREE.BoxGeometry(0.14, 0.06, 0.1),
      new THREE.MeshBasicMaterial({ color: COLORS[o.id] ?? 0xcccccc }),
    );
    mesh.name = `object:${o.id}`;
    mesh.geometry.computeBoundingBox();
    const halfH = (mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y) / 2;
    mesh.userData = { id: o.id, kind: 'object', home: o.on, halfH };
    const fg = furniture.get(o.on);
    root.updateMatrixWorld(true);
    // 初始摆放同样走 attach：先放到世界坐标，再挂到家具下，世界位置不变。
    // layout 里 pos.y 是台面高度，物体中心要抬半个身高才"坐"在台面上。
    mesh.position.set(o.pos[0], o.pos[1] + halfH, o.pos[2]);
    root.add(mesh);
    root.updateMatrixWorld(true);
    fg.attach(mesh);
    objects.set(o.id, mesh);
  }
  root.updateMatrixWorld(true);

  const world = {
    root, layout, rooms, furniture, objects,
    /** 注册表：按 id 取对象 / 按分区列出物体 / 取世界坐标 */
    getObject: (id) => objects.get(id),
    getFurniture: (id) => furniture.get(id),
    objectsInRoom(roomId) {
      return [...objects.values()].filter((m) => world.roomOf(m.userData.id) === roomId).map((m) => m.userData.id);
    },
    roomOf(objectId) {
      // 以物体当前的世界位置所在格子为准（被抓走后随机器人移动，不再属于原分区）
      const p = world.worldPos(objectId);
      for (const r of layout.rooms) {
        const [rc, rr, rw, rh] = r.rect;
        const { cell, origin } = layout.grid;
        const c = Math.floor((p[0] - origin[0]) / cell);
        const z = Math.floor((p[2] - origin[2]) / cell);
        if (c >= rc && c < rc + rw && z >= rr && z < rr + rh) return r.id;
      }
      return null;
    },
    worldPos(id) {
      const m = objects.get(id) || furniture.get(id);
      const v = new THREE.Vector3();
      m.updateWorldMatrix(true, false);
      m.getWorldPosition(v);
      return [v.x, v.y, v.z];
    },
  };
  return world;
}
