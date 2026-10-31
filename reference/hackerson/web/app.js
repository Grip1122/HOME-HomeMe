'use strict';
const $=id=>document.getElementById(id);
let state=null,connected=false,lastEvent='',cloud=[],cloudView=false,drag=null,restaurantView=false,currentScene='';
let orbit={yaw:-.7,pitch:.9,zoom:1};
const phases={booting:'初始化',ready:'准备就绪',scanning:'采集 RGB-D',planning:'选择下一视角',moving:'移动至扫描点',adjusting:'调整高度 / 角度',completed:'扫描结束',error:'运行异常'};
const reasons={scan_budget:'达到扫描次数预算',diminishing_returns:'连续扫描新增信息较少',candidates_exhausted:'候选视角已执行完毕',low_expected_gain:'剩余候选预估收益低'};
const fmt=n=>Number(n||0).toLocaleString('en-US');
function banner(text){$('error-banner').textContent=text;$('error-banner').hidden=!text;}
async function command(action,extra={}){
  try{const response=await fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...extra})});if(!response.ok){const result=await response.json();throw Error(result.error||'请求失败');}banner('');}
  catch(error){banner(`操作未执行：${error.message}`);}
}
function writeNumber(id,value,unit){$(id).replaceChildren(document.createTextNode(value));if(unit){const small=document.createElement('small');small.textContent=unit;$(id).append(small);}}
function update(s){
  if(!connected)banner('');state=s;connected=true;$('connection').classList.add('ok');$('connection').lastChild.textContent='服务器已连接';
  if(s.status==='error'){banner(s.error||'仿真运行异常');$('start').disabled=true;return;}
  if(s.status==='booting'){$('phase-badge').textContent='初始化';return;}
  $('scene-select').disabled=false;$('scene-select').value=s.scene||'demo';
  const restaurant=s.scene==='restaurant';
  $('tab-restaurant').hidden=!restaurant;$('scene-credit').hidden=!restaurant;
  $('tab-scene').textContent=restaurant?'几何代理':'仿真场景';
  $('scene-code').textContent=restaurant?'RESTAURANT / HILO':'ROOM_01';
  $('scene-dimensions').textContent=restaurant?'餐厅资产 · 尺度待标定':'8.0 × 6.0 × 2.8 m';
  $('scene-note').textContent=restaurant?'1 场景单位暂按 1 米 · 导航限于连通可行区域':'已知地图 · 仿真位姿';
  $('sensor-kind').textContent=restaurant?'原景 RGB · 代理深度 · 停车采集时更新':'四路 RGB-D · 原始视图拼排';
  document.querySelector('.coverage-name').firstChild.textContent=restaurant?'几何代理参考表面覆盖率 ':'参考可见表面覆盖率 ';
  document.querySelector('.chart-foot').textContent=restaurant?'由相机观测更新 · 非餐厅全部真实表面':'参考表面按面积加权 · 场景真值仅用于评估';
  if(currentScene!==s.scene){currentScene=s.scene;cloud=[];if(restaurant)showRestaurant();else setView(false);}
  if(restaurantView)window.restaurantRenderer?.show(true);
  window.dispatchEvent(new CustomEvent('scan-state',{detail:s}));
  const running=s.status==='running',paused=s.status==='paused',done=s.status==='completed';
  $('coverage').textContent=s.coverage.toFixed(1);$('progress').style.strokeDashoffset=207.35*(1-s.coverage/100);
  $('ring-count').textContent=String(s.scans).padStart(2,'0');$('scan-counter').textContent=`SCAN ${String(s.scans).padStart(2,'0')} / ${s.max_scans}`;
  writeNumber('points',fmt(s.cloud_points),'points');writeNumber('distance',s.distance_m.toFixed(1),'m');writeNumber('height',s.height.toFixed(2),'m');writeNumber('tilt',s.tilt_deg.toFixed(0),'°');
  const known=s.known_voxels/s.total_voxels*100;$('known').textContent=known.toFixed(1)+'%';$('known-bar').style.width=known+'%';
  $('point-badge').textContent=s.cloud_points>1000?(s.cloud_points/1000).toFixed(1)+'k':s.cloud_points;
  $('phase-badge').textContent=paused?'已暂停':phases[s.phase]||s.phase;
  $('start').disabled=done;$('start').textContent=running?'Ⅱ 暂停扫描':paused?'▶ 继续扫描':done?'✓ 扫描已结束':'▶ 开始扫描';
  $('reset').disabled=false;$('export').disabled=!s.scans;$('strategy').value=s.strategy;
  $('strategy').disabled=running||paused;
  $('elapsed').textContent=`${String(Math.floor(s.elapsed_s/60)).padStart(2,'0')}:${String(Math.floor(s.elapsed_s%60)).padStart(2,'0')}`;
  $('elapsed').title='累计仿真时间';document.querySelectorAll('[data-speed]').forEach(button=>button.classList.toggle('selected',Number(button.dataset.speed)===s.speed));
  $('mission-note').textContent=done?`${reasons[s.reason]||s.reason}。当前覆盖 ${s.coverage.toFixed(1)}%，结果已保存。`:paused?'任务已暂停，当前地图和轨迹已保留。':running?'自主任务运行中：先收杆移动，再升杆观测；每次扫描后重新评估视角。':'点击开始。自适应策略将联合选择位置、高度和角度。';
  if(s.target){$('target-position').textContent=`(${s.target.xy[0].toFixed(2)}, ${s.target.xy[1].toFixed(2)}) m`;$('target-pose').textContent=`高度 ${s.target.height.toFixed(2)} m · 俯仰 ${s.target.tilt_deg.toFixed(0)}°`;$('gain').textContent=fmt(s.target.gain);}
  else{$('target-position').textContent='等待规划';$('target-pose').textContent='底盘位置 × 杆高 × 相机俯仰';$('gain').textContent='—';}
  $('downloads').hidden=!s.export_ready;
  if(!restaurant)$('sensor-status').textContent=s.scans?`第 ${s.scans} 次观测`:'等待首次扫描';
  $('ring').hidden=restaurant||!s.scans;
  if(!restaurant)$('raw-ring').hidden=true;
  const eventKey=JSON.stringify(s.events);
  if(eventKey!==lastEvent){lastEvent=eventKey;const container=$('events');container.replaceChildren();for(const item of [...s.events].reverse().slice(0,5)){const row=document.createElement('div');row.className='event';const index=document.createElement('span');index.textContent=String(item.scan).padStart(2,'0');const message=document.createElement('span');message.textContent=item.message;row.append(index,message);container.append(row);}}
  if(!s.scans){$('ring').removeAttribute('src');if(!restaurant)$('sensor-empty').hidden=false;cloud=[];drawCloud();}
  drawMap();drawChart();
}
async function poll(){
  try{const response=await fetch('/api/state');if(!response.ok)throw Error('HTTP '+response.status);update(await response.json());}
  catch(error){connected=false;$('connection').classList.remove('ok');$('connection').lastChild.textContent='连接中断';$('start').disabled=true;$('reset').disabled=true;$('export').disabled=true;banner('无法连接仿真服务。请检查服务器进程和 SSH 端口转发。');}
  setTimeout(poll,600);
}
async function refreshImage(id,url){
  const img=$(id);if(img.dataset.loading==='yes')return;img.dataset.loading='yes';
  try{const response=await fetch(url+'?t='+Date.now());if(!response.ok)return;const blob=await response.blob();const old=img.dataset.objectUrl;const next=URL.createObjectURL(blob);img.src=next;img.dataset.objectUrl=next;if(old)URL.revokeObjectURL(old);if(id==='scene')$('scene-placeholder').hidden=true;else $('sensor-empty').hidden=true;}
  catch{}finally{img.dataset.loading='no';}
}
function images(){if(connected&&state?.status!=='booting'&&state?.status!=='error'){if(!cloudView&&!restaurantView)refreshImage('scene','/frame.jpg');if(state?.scans&&state.scene!=='restaurant')refreshImage('ring','/ring.jpg');}setTimeout(images,80);}
async function fetchCloud(){try{if(connected&&state?.scans){const response=await fetch('/api/cloud');if(response.ok){cloud=(await response.json()).points;drawCloud();}}}catch{}setTimeout(fetchCloud,2200);}
function setupCanvas(id){const canvas=$(id),rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);if(!rect.width||!rect.height)return null;canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);return [ctx,rect.width,rect.height];}
function drawMap(){const setup=setupCanvas('map-view');if(!setup)return;const [c,w,h]=setup;c.clearRect(0,0,w,h);let bounds=state?.bounds||[[-4,-3,0],[4,3,2.8]];
  const floor=state?.scene_info?.floor_cells||[];
  if(floor.length){bounds=[[Math.min(...floor.map(p=>p[0]))-.7,Math.min(...floor.map(p=>p[1]))-.7,0],[Math.max(...floor.map(p=>p[0]))+.7,Math.max(...floor.map(p=>p[1]))+.7,3.5]];}
  const [lo,hi]=bounds,dx=hi[0]-lo[0],dy=hi[1]-lo[1],scale=Math.min((w-40)/dx,(h-30)/dy),ox=(w-scale*dx)/2,oy=(h-scale*dy)/2;
  const p=xy=>[ox+(xy[0]-lo[0])*scale,oy+(hi[1]-xy[1])*scale];
  c.strokeStyle='#25383f';c.lineWidth=1;for(let x=Math.ceil(lo[0]);x<=hi[0];x++){c.beginPath();c.moveTo(...p([x,lo[1]]));c.lineTo(...p([x,hi[1]]));c.stroke();}for(let y=Math.ceil(lo[1]);y<=hi[1];y++){c.beginPath();c.moveTo(...p([lo[0],y]));c.lineTo(...p([hi[0],y]));c.stroke();}c.strokeStyle='#71898e';c.strokeRect(ox,oy,dx*scale,dy*scale);
  if(floor.length){c.fillStyle='#244139';const size=state.scene_info.floor_cell_size*scale;for(const xy of floor){const q=p(xy);c.fillRect(q[0]-size/2,q[1]-size/2,size+.2,size+.2);}}
  if(!state?.layout)return;
  for(const box of state.layout){const a=p([box.center[0]-box.half[0],box.center[1]+box.half[1]]);c.fillStyle=box.name==='partition'?'#52646c':'#2d424a';c.fillRect(a[0],a[1],box.half[0]*2*scale,box.half[1]*2*scale);c.strokeStyle='#49616a';c.strokeRect(a[0],a[1],box.half[0]*2*scale,box.half[1]*2*scale);}
  function line(points,color,dash=[]){if(!points.length)return;c.beginPath();c.moveTo(...p(points[0]));for(const point of points.slice(1))c.lineTo(...p(point));c.strokeStyle=color;c.lineWidth=1.7;c.setLineDash(dash);c.stroke();c.setLineDash([]);}
  line(state.trace,'#65ddbd');line([state.xy,...state.path],'#8cabb3',[4,4]);
  for(const scan of state.history){const q=p(scan.xy);c.beginPath();c.arc(...q,2,0,Math.PI*2);c.fillStyle='#65ddbd';c.fill();}
  if(state.target){const q=p(state.target.xy);c.beginPath();c.arc(...q,5,0,Math.PI*2);c.strokeStyle='#eebf70';c.lineWidth=1.4;c.stroke();c.beginPath();c.arc(...q,1.5,0,Math.PI*2);c.fillStyle='#eebf70';c.fill();}
  const displayed=window.roomscanDisplayPose?.scene===state.scene?window.roomscanDisplayPose:state;
  const q=p(displayed.xy);c.save();c.translate(...q);c.rotate(-displayed.yaw);c.beginPath();c.arc(0,0,6,0,Math.PI*2);c.fillStyle='#163e37';c.fill();c.strokeStyle='#8beace';c.lineWidth=1.6;c.stroke();c.beginPath();c.moveTo(4,0);c.lineTo(10,0);c.stroke();c.restore();
}
function drawChart(){const setup=setupCanvas('coverage-chart');if(!setup)return;const [c,w,h]=setup;const left=35,top=20,right=w-20,bottom=h-25;c.clearRect(0,0,w,h);c.font='9px monospace';c.textAlign='right';
  for(const y of [0,25,50,75,100]){const py=bottom-y/100*(bottom-top);c.strokeStyle='#26363e';c.beginPath();c.moveTo(left,py);c.lineTo(right,py);c.stroke();c.fillStyle='#617e88';c.fillText(y+'%',left-8,py+3);}
  c.textAlign='center';const history=state?.history||[],limit=Math.max(12,state?.max_scans||48),px=n=>left+n/limit*(right-left),py=n=>bottom-n/100*(bottom-top);
  for(const n of [0,Math.round(limit/2),limit]){c.fillStyle='#617e88';c.fillText(n,px(n),bottom+16);}c.textAlign='right';c.fillText('扫描次数',right,top-6);
  if(!history.length){c.textAlign='center';c.fillStyle='#58717b';c.fillText('等待首轮观测',w/2,h/2);return;}
  const rows=[{scan:0,coverage:0},...history];const gradient=c.createLinearGradient(0,top,0,bottom);gradient.addColorStop(0,'#65ddbd30');gradient.addColorStop(1,'#65ddbd00');c.beginPath();c.moveTo(left,bottom);for(const row of rows)c.lineTo(px(row.scan),py(row.coverage));c.lineTo(px(rows.at(-1).scan),bottom);c.closePath();c.fillStyle=gradient;c.fill();c.beginPath();c.moveTo(left,bottom);for(const row of rows)c.lineTo(px(row.scan),py(row.coverage));c.strokeStyle='#65ddbd';c.lineWidth=2;c.stroke();const last=rows.at(-1);c.beginPath();c.arc(px(last.scan),py(last.coverage),3,0,Math.PI*2);c.fillStyle='#aff4d9';c.fill();
}
function drawCloud(){if(!cloudView)return;const setup=setupCanvas('cloud-view');if(!setup)return;const [c,w,h]=setup;c.fillStyle='#10191d';c.fillRect(0,0,w,h);const cy=Math.cos(orbit.yaw),sy=Math.sin(orbit.yaw),cp=Math.cos(orbit.pitch),sp=Math.sin(orbit.pitch),bounds=state?.bounds||[[-4,-3,0],[4,3,2.8]],span=Math.max(bounds[1][0]-bounds[0][0],bounds[1][1]-bounds[0][1]),scale=Math.min(w/(span*1.15),h/(span*.85))*orbit.zoom,center=[(bounds[0][0]+bounds[1][0])/2,(bounds[0][1]+bounds[1][1])/2,1.2];
  const project=p=>{const px=p[0]-center[0],py=p[1]-center[1],x=px*cy-py*sy,y=px*sy+py*cy,z=p[2]-center[2];return [w/2+x*scale,h/2+(y*cp-z*sp)*scale,y*sp+z*cp];};
  c.strokeStyle='#263b42';c.lineWidth=1;for(let i=-4;i<=4;i++){let a=project([i,-3,0]),b=project([i,3,0]);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();}for(let i=-3;i<=3;i++){let a=project([-4,i,0]),b=project([4,i,0]);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();}
  const points=cloud.map(p=>({p,q:project(p)})).sort((a,b)=>a.q[2]-b.q[2]);
  for(const {p,q} of points){c.fillStyle=`rgb(${Math.min(255,p[3]+25)} ${Math.min(255,p[4]+25)} ${Math.min(255,p[5]+25)})`;c.fillRect(q[0],q[1],Math.max(1.5,scale*.024),Math.max(1.5,scale*.024));}
  if(!points.length){c.textAlign='center';c.font='12px sans-serif';c.fillStyle='#7c909b';c.fillText('开始扫描后，在这里查看实际观测点云',w/2,h/2);}
}
function setView(isCloud){restaurantView=false;window.restaurantRenderer?.show(false);$('restaurant-view').hidden=true;$('restaurant-controls').hidden=true;$('scene-placeholder').hidden=true;$('tab-restaurant').classList.remove('active');$('tab-restaurant').setAttribute('aria-selected','false');cloudView=isCloud;$('scene').hidden=isCloud;$('cloud-view').hidden=!isCloud;$('reset-view').hidden=!isCloud;$('tab-scene').classList.toggle('active',!isCloud);$('tab-cloud').classList.toggle('active',isCloud);$('tab-scene').setAttribute('aria-selected',String(!isCloud));$('tab-cloud').setAttribute('aria-selected',String(isCloud));$('view-caption').textContent=isCloud?'拖动旋转 · 滚轮缩放 · 仅显示实际观测点':state?.scene==='restaurant'?'几何代理 · 扫描深度与避障使用该模型':'第三人称视图 · 屋顶与前墙剖切显示';if(isCloud)drawCloud();}
function showRestaurant(){setView(false);restaurantView=true;$('scene').hidden=true;$('restaurant-view').hidden=false;$('tab-scene').classList.remove('active');$('tab-scene').setAttribute('aria-selected','false');$('tab-restaurant').classList.add('active');$('tab-restaurant').setAttribute('aria-selected','true');$('view-caption').textContent='原始高斯剖切视图 · 拖动旋转 · 滚轮缩放 · Shift 拖动平移';window.restaurantRenderer?.show(true);}
$('start').onclick=()=>command(state?.status==='running'?'pause':'start');$('reset').onclick=()=>command('reset',{strategy:$('strategy').value});$('strategy').onchange=()=>command('reset',{strategy:$('strategy').value});$('export').onclick=()=>command('export');
document.querySelectorAll('[data-speed]').forEach(button=>button.onclick=()=>command('speed',{value:Number(button.dataset.speed)}));$('tab-scene').onclick=()=>setView(false);$('tab-cloud').onclick=()=>setView(true);$('reset-view').onclick=()=>{orbit={yaw:-.7,pitch:.9,zoom:1};drawCloud();};
const canvas=$('cloud-view');canvas.onpointerdown=event=>{drag=[event.clientX,event.clientY];canvas.setPointerCapture(event.pointerId);};canvas.onpointermove=event=>{if(!drag)return;orbit.yaw+=(event.clientX-drag[0])*.008;orbit.pitch=Math.max(.15,Math.min(2.8,orbit.pitch+(event.clientY-drag[1])*.008));drag=[event.clientX,event.clientY];drawCloud();};canvas.onpointerup=()=>{drag=null;};canvas.onpointercancel=()=>{drag=null;};canvas.onwheel=event=>{event.preventDefault();orbit.zoom=Math.max(.5,Math.min(3,orbit.zoom*Math.exp(-event.deltaY*.001)));drawCloud();};
new ResizeObserver(()=>{drawMap();drawChart();drawCloud();}).observe($('viewport'));
$('tab-restaurant').onclick=showRestaurant;
$('scene-select').onchange=()=>{$('scene-select').disabled=true;command('scene',{scene:$('scene-select').value});};
poll();images();fetchCloud();
window.addEventListener('render-pose',drawMap);
