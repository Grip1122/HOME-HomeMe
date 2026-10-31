const fs = require('fs'), assert = require('node:assert/strict'), path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = process.argv[2] || 'evidence';fs.mkdirSync(out,{recursive:true});
(async () => {
 const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 try {
  const page = await browser.newPage({viewport:{width:1800,height:1150}}), errors = [];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(process.env.RESTAURANT_URL || 'http://127.0.0.1:5173/restaurant-integration/index.html');
  await page.waitForFunction(()=>!!window.restaurantIntegration);
  if(process.env.SCENE_PLY)await page.locator('#localScene').setInputFiles(process.env.SCENE_PLY);
  else await page.click('#load');
  await page.waitForFunction(()=>window.restaurantIntegration.state().loaded||window.restaurantIntegration.state().error, {timeout:120000});
  assert.equal(await page.evaluate(()=>window.restaurantIntegration.state().error),null);
  const setup = await page.evaluate(async () => {
   const THREE = await import('three');
   const api = window.restaurantIntegration;
   document.querySelector('#badge').style.display='none'; // Headless FPS is not target-hardware performance evidence.
   const evidence = await fetch('/scene-data/restaurant_adapter_validation.json').then(r=>r.json());
   const overlay = new THREE.Scene();
   for (const id of api.semantics.navigation_proxy_ids) {
    const mesh = api.layer.getObjectById(id);
    const helper = new THREE.Box3Helper(new THREE.Box3().setFromObject(mesh),0xffb347);
    helper.material.depthTest=false; helper.material.transparent=true; helper.material.opacity=.5;
    overlay.add(helper);
   }
   const dots = [], labels=[];
   for (const row of evidence.objects) {
    const p = api.layer.worldPos(row.object_id), stand=row.nearest_stand_world_xz;
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p[0],.03,p[2]),new THREE.Vector3(stand[0],.03,stand[1])]);
    overlay.add(new THREE.Line(geo,new THREE.LineBasicMaterial({color:0x6befff,depthTest:false})));
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),new THREE.MeshBasicMaterial({color:0x6befff,depthTest:false}));
    dot.position.set(stand[0],.04,stand[1]);overlay.add(dot);dots.push(dot);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
    const c=canvas.getContext('2d');c.fillStyle='#102238dd';c.fillRect(0,0,256,64);c.fillStyle='white';c.font='20px sans-serif';c.fillText(row.object_id,8,26);c.fillStyle='#6befff';c.fillText(row.nearest_stand_distance_m.toFixed(3)+' m',8,52);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));
    sprite.position.set(p[0],p[1]+.36,p[2]);sprite.scale.set(1.7,.425,1);overlay.add(sprite);labels.push(sprite);
   }
   const render=api.viewer.render.bind(api.viewer);
   api.viewer.render=()=>{render();const renderer=api.viewer.renderer,old=renderer.autoClear;renderer.autoClear=false;renderer.render(overlay,api.camera);renderer.autoClear=old;};
   document.querySelector('#bounds').click();
   const pitch=Math.atan2(Math.abs(api.camera.position.y-.5),Math.hypot(api.camera.position.x-.6,api.camera.position.z-.3))*180/Math.PI;
   document.querySelector('aside').innerHTML='<h1>餐厅 world adapter 联调</h1><p>同一原版 PLY + layout_restaurant.json</p><p>正交相机 · 俯角 '+pitch.toFixed(3)+'°</p><p>橙线：99 个真实碰撞代理网格<br>绿线：家具四点轮廓<br>青点：从扫描点可达的最近可站格<br>青线：物体到可站格的水平距离</p><p>8 件任务物体，距离 0.432–0.837 米<br>导航半径 0.25 米；抓取阈值 1 米</p><p>A 原执行器来自 PR #20 / 1499b6a<br>B 适配器基于 PR #23 / a65f053</p><p id="a-results">等待执行 A find → grab → drop</p><p>原版 999131 高斯，SH0<br>显示裁切上部；布局坐标未裁切</p><p>Hilo / heroizme · CC BY 4.0<br>superspl.at/scene/40c67340</p><p>此为已有页面上的联调证据。<br>最终主入口、机器人 GLB 和后端尚未验收。</p>';
   window.aEvidenceOverlay={overlay,dots,labels};
   return {gaussians:api.viewer.splatMesh.getSplatCount(),pitch,isOrthographicCamera:api.camera.isOrthographicCamera,objects:evidence.objects.map(o=>({id:o.object_id,distance_m:o.nearest_stand_distance_m}))};
  });
  assert.equal(setup.gaussians,999131);assert.ok(Math.abs(setup.pitch-45)<1e-8);assert.equal(setup.isOrthographicCamera,true);
  await page.waitForTimeout(1000);
  await page.screenshot({path:path.join(out,'restaurant-adapter-45.png')});
  const execution = await page.evaluate(async()=>{
   const THREE=await import('three');
   const [{createEventBus},{createStateMachine},{createTicker},{createTaskQueue},{createLocalMemory},{createRobot},{createExecutor},{buildGrid},{drive}] = await Promise.all([
    import('/src/core/eventbus.js'),import('/src/core/statemachine.js'),import('/src/core/ticker.js'),import('/src/core/taskqueue.js'),import('/src/core/memory.js'),import('/src/robot/robot.js'),import('/src/robot/executor.js'),import('/src/nav/route.js'),import('/src/core/sim.js')]);
   const api=window.restaurantIntegration,world=api.layer,layout=api.layout,ticker=createTicker(),bus=createEventBus({now:()=>ticker.time*1000});
   const robot=createRobot({root:new THREE.Group()});
   const scan=layout.rooms[0].scan_point;robot.setPose(scan[0],scan[2],0);world.root.add(robot.group);
   // Visible marker uses actual robot group; graphics never drive action logic.
   const marker=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.42,16),new THREE.MeshBasicMaterial({color:0x229dff,depthTest:false}));marker.position.y=.21;robot.group.add(marker);
   const ctx={world,layout,ticker,bus,robot,grid:buildGrid(layout),sm:createStateMachine({bus}),memory:createLocalMemory({bus,enabled:false}),holding:null,handBusy:false,options:{}};
   const executor=createExecutor(ctx,createTaskQueue());
   const result=await drive(ticker,executor.submitPlan({source:'script',steps:[{action:'find',target:'cup_red'},{action:'grab',target:'cup_red'},{action:'drop',target:'cup_red',to:'table_03'}]}),{dt:1/30,maxSeconds:600,onFrame(){api.viewer.render();}});
   const steps=bus.log.filter(e=>e.name==='task:step').map(e=>e.payload);
   document.querySelector('#a-results').textContent='A 原执行器实跑：\n'+steps.map(s=>s.action+'：'+(s.ok?'通过':'失败')).join('\n')+'\n红杯 table_01 → table_03\n最终挂在 '+world.getObject('cup_red').parent.name+'\nholding = '+ctx.holding;
   return {result,steps,final_parent:world.getObject('cup_red').parent.name,final_world:world.worldPos('cup_red'),holding:ctx.holding,simulated_seconds:ticker.time};
  });
  assert.equal(execution.result.ok,true);assert.equal(execution.final_parent,'furniture:table_03');assert.equal(execution.holding,null);
  await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'restaurant-a-executor-drop.png')});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'restaurant-adapter-browser.json'),JSON.stringify({scope:'Existing B preview, real original PLY loaded; actual unmodified A executor performs cross-table find/grab/drop using B world adapter; no new page or main-entry claim.',browser:'Chrome headless',...setup,execution,page_errors:errors},null,2));
  console.log(JSON.stringify({gaussians:setup.gaussians,pitch:setup.pitch,A_result:execution.result,errors}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
