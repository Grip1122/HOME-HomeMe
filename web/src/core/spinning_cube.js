import * as THREE from 'three';

/** 创建脚手架用的立方体。size 必须是正的有限数。 */
export function createCube(size = 1) {
  if (!Number.isFinite(size) || size <= 0) {
    throw new RangeError(`size 必须是正的有限数，收到 ${size}`);
  }
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshNormalMaterial();
  return new THREE.Mesh(geometry, material);
}

/** 按时间步长旋转。dt 单位秒，负数或非有限数直接拒绝，避免时钟回拨把动画拧乱。 */
export function stepRotation(mesh, dt, speed = 1) {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new RangeError(`dt 必须是非负有限数，收到 ${dt}`);
  }
  mesh.rotation.x += dt * speed * 0.7;
  mesh.rotation.y += dt * speed;
}
