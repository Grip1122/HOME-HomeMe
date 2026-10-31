/** Restaurant scene data adapter. Dependencies injected to avoid mixing Three versions. */
export function sourcePointToLayout(point, frame) {
 if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite)) throw new TypeError('point must contain three finite coordinates');
 const q=frame.raw_ply_entity_transform.quaternion_xyzw,t=frame.raw_ply_entity_transform.position,s=frame.raw_ply_entity_transform.scale;
 const [x,y,z]=point.map(n=>n*s),[qx,qy,qz,qw]=q;
 const tx=2*(qy*z-qz*y),ty=2*(qz*x-qx*z),tz=2*(qx*y-qy*x);
 return [x+qw*tx+qy*tz-qz*ty+t[0],y+qw*ty+qz*tx-qx*tz+t[1],z+qw*tz+qx*ty-qy*tx+t[2]];
}

export function createRestaurantScene({THREE,layout,semantics}) {
 const ids=new Set();for(const f of layout.furniture){if(ids.has(f.id))throw new Error('duplicate registry id: '+f.id);ids.add(f.id);if(!Array.isArray(f.pos)||f.pos.length!==3||!f.pos.every(Number.isFinite)||!Array.isArray(f.size)||f.size.length!==3||!f.size.every(n=>Number.isFinite(n)&&n>0))throw new TypeError('invalid furniture: '+f.id);}
 for(const id of semantics.navigation_proxy_ids){if(!layout.furniture.some(f=>f.id===id&&f.blocks))throw new Error('navigation proxy must remain installed and blocking: '+id);}
 const root=new THREE.Group(),entries=new Map(),colliders=new THREE.Group(),surfaces=new THREE.Group(),tasks=new THREE.Group();
 root.name='restaurant';root.add(colliders,surfaces,tasks);
 const semanticIds=new Set(semantics.semantic_ids),proxyIds=new Set(semantics.navigation_proxy_ids),surfaceById=new Map();
 function register(id,value){if(entries.has(id))throw new Error('duplicate registry id: '+id);entries.set(id,value);}
 for(const f of layout.furniture){
  if(!f.pos?.every(Number.isFinite)||!f.size?.every(n=>Number.isFinite(n)&&n>0))throw new TypeError('invalid furniture: '+f.id);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...f.size),new THREE.MeshBasicMaterial({visible:false}));mesh.position.set(...f.pos.map((n,k)=>n+f.size[k]/2));mesh.name=f.id;mesh.userData={id:f.id,room:f.room,blocks:f.blocks,role:proxyIds.has(f.id)?'navigation-proxy':'semantic-furniture'};colliders.add(mesh);
  register(f.id,{id:f.id,room:f.room,type:semanticIds.has(f.id)?'furniture':'navigation-proxy',object:mesh,definition:f});
  if(f.surface){
   const polygon=semantics.footprints_xz[f.id];if(!polygon||polygon.length!==4)throw new Error('surface footprint missing: '+f.id);
   const positions=[];for(const p of polygon)positions.push(p[0],f.pos[1]+f.size[1],p[1]);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();const plane=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));plane.name='surface_'+f.id;plane.userData={furnitureId:f.id,room:f.room};surfaces.add(plane);surfaceById.set(f.id,plane);
  }
 }
 const colors={cup_red:0xff4646,bottle_green:0x5df391,remote_black:0xb0b0bc,keys_yellow:0xffe65a,phone_white:0xffffff,notebook_orange:0xff952d,book_blue:0x419dff,glasses_black:0x8477bc};
 for(const o of layout.objects){
  if(!surfaceById.has(o.on))throw new Error('task object surface not found: '+o.on);
  const group=new THREE.Group();group.name=o.id;group.position.fromArray(o.pos);group.userData={id:o.id,room:o.room,on:o.on};
  const geometry=o.id==='cup_red'||o.id==='bottle_green'?new THREE.CylinderGeometry(.055,.055,.14,16):new THREE.BoxGeometry(.13,.08,.11),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:colors[o.id]??0xff66db}));mesh.position.y=o.id==='cup_red'||o.id==='bottle_green'?.07:.04;group.add(mesh);tasks.attach(group);register(o.id,{id:o.id,room:o.room,type:'task-object',object:group,definition:o});
 }
 root.updateMatrixWorld(true);
 const getEntry=id=>{const value=entries.get(id);if(!value)throw new Error('unknown scene id: '+id);return value;};
 return {root,colliders,surfaces,tasks,entries,surfaceById,
  getObjectById:id=>getEntry(id).object,
  listObjectsByRoom:(room,{includeNavigation=false}={})=>[...entries.values()].filter(e=>e.room===room&&(includeNavigation||e.type!=='navigation-proxy')).map(e=>({id:e.id,type:e.type})),
  getWorldPosition:id=>{root.updateMatrixWorld(true);return getEntry(id).object.getWorldPosition(new THREE.Vector3()).toArray();},
  getSurfacePosition:id=>{const entry=getEntry(id),f=entry.definition;if(!f.surface)throw new Error('not a placement surface: '+id);return [f.pos[0]+f.size[0]/2,f.pos[1]+f.size[1],f.pos[2]+f.size[2]/2];},
  attachKeepingWorld:(id,parent)=>{if(!parent?.isObject3D)throw new TypeError('parent must be Object3D');root.updateMatrixWorld(true);parent.updateWorldMatrix(true,false);const object=getEntry(id).object,before=object.getWorldPosition(new THREE.Vector3());parent.attach(object);object.updateWorldMatrix(true,false);const after=object.getWorldPosition(new THREE.Vector3());return {before:before.toArray(),after:after.toArray(),error:before.distanceTo(after)};},
  dispose(){root.traverse(o=>{o.geometry?.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)m?.dispose();});root.removeFromParent();entries.clear();surfaceById.clear();}
 };
}
