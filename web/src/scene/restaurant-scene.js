/** Restaurant scene data adapter. Dependencies injected to avoid mixing Three versions. */
export function sourcePointToLayout(point, frame) {
 if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) throw new TypeError('point must contain three finite coordinates');
 const q=frame.raw_ply_entity_transform.quaternion_xyzw,t=frame.raw_ply_entity_transform.position,s=frame.raw_ply_entity_transform.scale;
 const [x,y,z]=point.map(n=>n*s),[qx,qy,qz,qw]=q;
 const tx=2*(qy*z-qz*y),ty=2*(qz*x-qx*z),tz=2*(qx*y-qy*x);
 return [x+qw*tx+qy*tz-qz*ty+t[0],y+qw*ty+qz*tx-qx*tz+t[1],z+qw*tz+qx*ty-qy*tx+t[2]];
}

export function createRestaurantScene({ THREE, layout, semantics }) {
 const ids = new Set();
 for (const f of layout.furniture) {
  if (ids.has(f.id)) throw new Error('duplicate registry id: ' + f.id);
  ids.add(f.id);
  if (!Array.isArray(f.pos) || f.pos.length !== 3 || !f.pos.every(Number.isFinite) ||
      !Array.isArray(f.size) || f.size.length !== 3 || !f.size.every(n => Number.isFinite(n) && n > 0)) {
   throw new TypeError('invalid furniture: ' + f.id);
  }
 }
 for (const id of semantics.navigation_proxy_ids) {
  if (!layout.furniture.some(f => f.id === id && f.blocks)) {
   throw new Error('navigation proxy must remain installed and blocking: ' + id);
  }
 }
 const root = new THREE.Group(), colliders = new THREE.Group();
 const surfaces = new THREE.Group(), tasks = new THREE.Group();
 const entries = new Map(), surfaceById = new Map();
 const rooms = new Map(), furniture = new Map(), objects = new Map();
 const semanticIds = new Set(semantics.semantic_ids);
 const proxyIds = new Set(semantics.navigation_proxy_ids);
 root.name = 'restaurant';
 root.add(colliders, surfaces, tasks);
 for (const r of layout.rooms) {
  const group = new THREE.Group();
  group.name = 'room:' + r.id;
  root.add(group);
  rooms.set(r.id, group);
 }
 function register(id, value) {
  if (entries.has(id)) throw new Error('duplicate registry id: ' + id);
  entries.set(id, value);
 }
 for (const f of layout.furniture) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...f.size), new THREE.MeshBasicMaterial({ visible: false }));
  mesh.name = f.id;
  mesh.userData = { id: f.id, room: f.room, blocks: f.blocks, role: proxyIds.has(f.id) ? 'navigation-proxy' : 'semantic-furniture' };
  if (semanticIds.has(f.id)) {
   // Same origin and userData semantics as A's robot/world.js.
   // Room groups and root must stay identity: A settleOnSurface uses these local positions as world positions.
   const group = new THREE.Group();
   group.name = 'furniture:' + f.id;
   group.position.set(f.pos[0] + f.size[0] / 2, f.pos[1], f.pos[2] + f.size[2] / 2);
   group.userData = {
    id: f.id, kind: 'furniture', room: f.room, surface: f.surface,
    top: f.pos[1] + f.size[1],
    box: [f.pos[0], f.pos[2], f.pos[0] + f.size[0], f.pos[2] + f.size[2]],
    surfacePolygon: semantics.footprints_xz[f.id],
   };
   mesh.position.y = f.size[1] / 2;
   group.add(mesh);
   const room = rooms.get(f.room);
   if (!room) throw new Error('unknown furniture room: ' + f.room);
   room.add(group);
   furniture.set(f.id, group);
  } else {
   // Navigation proxies are intentionally NOT actionable furniture.
   mesh.position.set(...f.pos.map((n, k) => n + f.size[k] / 2));
   colliders.add(mesh);
  }
  register(f.id, { id: f.id, room: f.room, type: semanticIds.has(f.id) ? 'furniture' : 'navigation-proxy', object: mesh, definition: f });
  if (f.surface) {
   const polygon = semantics.footprints_xz[f.id];
   if (!polygon || polygon.length !== 4) throw new Error('surface footprint missing: ' + f.id);
   const positions = [];
   for (const p of polygon) positions.push(p[0], f.pos[1] + f.size[1], p[1]);
   const geometry = new THREE.BufferGeometry();
   geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
   geometry.setIndex([0, 1, 2, 0, 2, 3]);
   geometry.computeVertexNormals();
   const plane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
   plane.name = 'surface_' + f.id;
   plane.userData = { furnitureId: f.id, room: f.room };
   surfaces.add(plane);
   surfaceById.set(f.id, plane);
  }
 }
 const colors = { cup_red: 0xff4646, bottle_green: 0x5df391, remote_black: 0xb0b0bc, keys_yellow: 0xffe65a, phone_white: 0xffffff, notebook_orange: 0xff952d, book_blue: 0x419dff, glasses_black: 0x8477bc };
 for (const o of layout.objects) {
  if (!surfaceById.has(o.on) || !furniture.has(o.on)) throw new Error('task object surface not found: ' + o.on);
  const cylinder = o.id === 'cup_red' || o.id === 'bottle_green';
  const halfH = cylinder ? .07 : .04;
  const geometry = cylinder ? new THREE.CylinderGeometry(.055, .055, .14, 16) : new THREE.BoxGeometry(.13, .08, .11);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: colors[o.id] ?? 0xff66db }));
  mesh.name = 'object:' + o.id;
  mesh.userData = { id: o.id, kind: 'object', home: o.on, halfH };
  // layout pos.y is the contact point; A worldPos returns the object's center.
  mesh.position.set(o.pos[0], o.pos[1] + halfH, o.pos[2]);
  root.attach(mesh);
  root.updateMatrixWorld(true);
  furniture.get(o.on).attach(mesh);
  objects.set(o.id, mesh);
  register(o.id, { id: o.id, room: o.room, type: 'task-object', object: mesh, definition: o });
 }
 root.updateMatrixWorld(true);
 const getEntry = id => {
  const value = entries.get(id);
  if (!value) throw new Error('unknown scene id: ' + id);
  return value;
 };
 const world = {
  root, layout, rooms, furniture, objects, colliders, surfaces, tasks, entries, surfaceById,
  // A world adapter, verified against PR #20 at 1499b6a.
  getFurniture: id => furniture.get(id),
  getObject: id => objects.get(id),
  worldPos(id) {
   const object = objects.get(id) || furniture.get(id);
   if (!object) throw new RangeError('unknown actionable scene id: ' + id);
   object.updateWorldMatrix(true, false);
   return object.getWorldPosition(new THREE.Vector3()).toArray();
  },
  roomOf(id) {
   const p = world.worldPos(id), { cell, origin } = layout.grid;
   const c = Math.floor((p[0] - origin[0]) / cell), r = Math.floor((p[2] - origin[2]) / cell);
   return layout.rooms.find(room => {
    const [x, z, w, h] = room.rect;
    return c >= x && c < x + w && r >= z && r < z + h;
   })?.id ?? null;
  },
  objectsInRoom: room => [...objects.keys()].filter(id => world.roomOf(id) === room),
  // Legacy B debug access; furniture mesh position is its box center.
  getObjectById: id => getEntry(id).object,
  listObjectsByRoom: (room, { includeNavigation = false } = {}) =>
   [...entries.values()].filter(e => (e.type === 'task-object' ? world.roomOf(e.id) : e.room) === room &&
    (includeNavigation || e.type !== 'navigation-proxy')).map(e => ({ id: e.id, type: e.type })),
  getWorldPosition(id) {
   const object = getEntry(id).object;
   object.updateWorldMatrix(true, false);
   return object.getWorldPosition(new THREE.Vector3()).toArray();
  },
  getSurfacePosition(id) {
   const f = getEntry(id).definition;
   if (!f.surface) throw new Error('not a placement surface: ' + id);
   return [f.pos[0] + f.size[0] / 2, f.pos[1] + f.size[1], f.pos[2] + f.size[2] / 2];
  },
  attachKeepingWorld(id, parent) {
   if (!parent?.isObject3D) throw new TypeError('parent must be Object3D');
   const object = getEntry(id).object;
   object.updateWorldMatrix(true, false);
   parent.updateWorldMatrix(true, false);
   const before = object.getWorldPosition(new THREE.Vector3());
   parent.attach(object);
   const after = object.getWorldPosition(new THREE.Vector3());
   return { before: before.toArray(), after: after.toArray(), error: before.distanceTo(after) };
  },
  dispose() {
   const geometries = new Set(), materials = new Set();
   const collect = o => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) materials.add(m);
   };
   root.traverse(collect);
   // Held objects can be outside this root.
   for (const object of objects.values()) { object.traverse(collect); object.removeFromParent(); }
   for (const g of geometries) g.dispose();
   for (const m of materials) m.dispose();
   root.removeFromParent();
   for (const map of [entries, surfaceById, rooms, furniture, objects]) map.clear();
  },
 };
 return world;
}
