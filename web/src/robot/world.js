// 世界：按 layout 建"世界 -> 分区 -> 家具 -> 物体"四层场景图，并提供注册表查询。
// 这里只做演示/测试用的最小实现（家具是隐形包围盒，物体是彩色小几何体）；
// 正式的点云对齐、碰撞层标定属于设计 B（web/src/scene/），届时替换本文件，接口不变。
import * as THREE from 'three';
import { furnitureBox } from '../nav/grid.js';
import { createWorldPort, assertWorldPort } from './world-port.js';

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

  return assertWorldPort(createWorldPort({ root, layout, rooms, furniture, objects }));
}
