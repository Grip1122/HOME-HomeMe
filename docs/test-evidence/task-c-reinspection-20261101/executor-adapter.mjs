/** Asset adapter for A's robot port. Pass the same THREE used by the loader,
 * world and executor. No second Three instance, extra carry anchor or rig. */
export function createExecutorRobot({ THREE, scene, createRobot, height = 1.2, maxRadius = null, frontYaw = -Math.PI / 2 }) {
  if (!(scene instanceof THREE.Object3D)) throw new TypeError('Model and executor must share the same Three instance');
  if (!(Number.isFinite(height) && height > 0) || !Number.isFinite(frontYaw)) throw new TypeError('Invalid display transform');
  if (maxRadius !== null && !(Number.isFinite(maxRadius) && maxRadius > 0)) throw new TypeError('Invalid navigation radius');
  if (scene.getObjectByName('carryAnchor')) throw new TypeError('Pass the raw GLB scene, not an existing robot wrapper');
  const model = scene.clone(true);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  if (!(size.y > 0)) throw new TypeError('Empty model');
  let sourceRadius = 0;
  const point = new THREE.Vector3();
  model.traverse((node) => {
    const positions = node.isMesh && node.geometry?.getAttribute('position');
    if (!positions) return;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
      sourceRadius = Math.max(sourceRadius, Math.hypot(point.x - center.x, point.z - center.z));
    }
  });
  const scale = Math.min(height / size.y, maxRadius !== null && sourceRadius > 0 ? maxRadius / sourceRadius : Infinity);
  model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  const visual = new THREE.Group(); visual.name = 'userRobotVisual';
  visual.add(model); visual.scale.setScalar(scale); visual.rotation.y = frontYaw;
  // A creates the single canonical carryAnchor from core/config.js.
  const robot = createRobot({ root: visual, clips: [] });
  if (!robot.group?.isObject3D || !robot.carryAnchor?.isObject3D ||
      robot.group.getObjectsByProperty('name', 'carryAnchor').length !== 1) {
    throw new TypeError('A robot factory did not provide a unique carryAnchor');
  }
  robot.group.userData.modelCapabilities = { rootTranslation: true, rootYaw: true, bones: 0, animationClips: 0, articulatedGrasp: false };
  robot.group.userData.displayHeightMeters = size.y * scale;
  robot.group.userData.geometryRadiusMeters = sourceRadius * scale;
  robot.group.userData.requestedHeightMeters = height;
  robot.group.userData.navigationRadiusMeters = maxRadius;
  robot.group.userData.heightIsMeasured = false;
  return robot;
}
