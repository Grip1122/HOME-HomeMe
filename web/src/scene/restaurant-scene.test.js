import {test} from 'vitest';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import layout from '../../public/layouts/layout_restaurant.json';
import semantics from '../../public/scene-data/restaurant_semantics.json';
import config from '../../public/scene-data/restaurant_scene_config.json';
import {createRestaurantScene,sourcePointToLayout} from './restaurant-scene.js';

test('raw point follows one scene quaternion and ground translation',()=>{
 const point=[1.2,-.6,3.1],angle=config.frame.yaw_degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),t=config.frame.raw_ply_entity_transform.position;
 const expected=[-point[0]*c+point[2]*s,-point[1]+t[1],point[0]*s+point[2]*c];
 sourcePointToLayout(point,config.frame).forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-12));
 assert.deepEqual(sourcePointToLayout([0,0,0],config.frame),t);
 assert.throws(()=>sourcePointToLayout([Infinity,0,0],config.frame),TypeError);
});

test('semantic registry has task coordinates, hidden proxies and real surface heights',()=>{
 const layer=createRestaurantScene({THREE,layout,semantics});
 assert.equal(layer.listObjectsByRoom('restaurant').length,71);assert.equal(layer.surfaceById.size,14);
 for(const o of layout.objects)layer.getWorldPosition(o.id).forEach((n,i)=>assert.ok(Math.abs(n-o.pos[i])<1e-12));
 for(const id of semantics.navigation_proxy_ids)assert.equal(layer.getObjectById(id).material.visible,false);
 assert.ok(Math.abs(layer.getSurfacePosition('table_01')[1]-layout.furniture.find(f=>f.id==='table_01').size[1])<1e-12);
 assert.throws(()=>layer.getObjectById('missing'),/unknown/);layer.dispose();assert.equal(layer.entries.size,0);
});

test('attach retains world coordinates with parent transform',()=>{
 const layer=createRestaurantScene({THREE,layout,semantics}),parent=new THREE.Group();parent.position.set(2,.7,-1);parent.rotation.y=.6;parent.scale.setScalar(1.5);layer.root.add(parent);
 assert.ok(layer.attachKeepingWorld('cup_red',parent).error<1e-6);assert.ok(layer.attachKeepingWorld('cup_red',layer.tasks).error<1e-6);layer.dispose();
});

test('negative sizes and removing blocking proxies fail',()=>{
 const bad=structuredClone(layout);bad.furniture[0].size[0]=-1;assert.throws(()=>createRestaurantScene({THREE,layout:bad,semantics}),/invalid furniture/);
 const removed=structuredClone(layout);removed.furniture.find(f=>f.id===semantics.navigation_proxy_ids[0]).blocks=false;assert.throws(()=>createRestaurantScene({THREE,layout:removed,semantics}),/must remain installed/);
});
