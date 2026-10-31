"""MuJoCo RGB-D acquisition, kinematic execution and autonomous scan loop."""
import os
os.environ.setdefault('MUJOCO_GL','egl')
from datetime import datetime
from pathlib import Path
import io
import json
import math
import time
import traceback
from zoneinfo import ZoneInfo
import mujoco
import numpy as np
from PIL import Image
from .world import BOXES, START, Navigation, scene_xml, safe_xy
from .mapping import OnlineMap, SurfaceEvaluator, pixel_vectors, WIDTH, HEIGHT
from .planner import Planner

ROOT=Path(__file__).resolve().parents[1]


def jpeg(pixels):
    out=io.BytesIO()
    Image.fromarray(pixels).save(out,format='JPEG',quality=82)
    return out.getvalue()


class Engine:
    def __init__(self, strategy='adaptive', max_scans=48, scene='demo'):
        self.scene_name=scene
        self.restaurant=None
        if scene=='restaurant':
            from .restaurant import Restaurant
            self.restaurant=Restaurant()
        self.bounds=self.restaurant.bounds if self.restaurant else [[-4.,-3.,0.],[4.,3.,2.8]]
        self.start_xy=self.restaurant.start if self.restaurant else START
        self.safety=self.restaurant.safe if self.restaurant else safe_xy
        self.scene_info=self.restaurant.public() if self.restaurant else {'scene':'demo','name':'演示房间','bounds':self.bounds,'scale_calibrated':True}
        self.model=mujoco.MjModel.from_xml_string(self.restaurant.xml() if self.restaurant else scene_xml())
        self.data=mujoco.MjData(self.model)
        self.data.qpos[:2]=self.start_xy
        mujoco.mj_forward(self.model,self.data)
        self.nav=self.restaurant.navigation() if self.restaurant else Navigation()
        self.evaluator=self.restaurant.evaluator(self.model,self.data,self.nav.candidates) if self.restaurant else SurfaceEvaluator(self.nav.candidates)
        self.sensor=mujoco.Renderer(self.model,height=HEIGHT,width=WIDTH)
        self.overview=mujoco.Renderer(self.model,height=600,width=960)
        self.sensor_options=mujoco.MjvOption()
        self.sensor_options.geomgroup[3]=1  # Sensors MUST see roof/front wall hidden in the cutaway.
        self.sensor_options.geomgroup[5]=0  # Decorative RS-01 meshes do not change sensor physics.
        self.overview_options=mujoco.MjvOption()
        self.overview_options.geomgroup[3]=0  # Cutaway for external view only.
        self.overview_options.geomgroup[2]=0  # Original conservative robot self-geometry.
        self.overview_options.geomgroup[5]=1  # Detailed RS-01 crawler exterior.
        if self.restaurant:self.overview_options.geomgroup[4]=1
        self.camera=mujoco.MjvCamera()
        self.camera.lookat[:]=[0,0,.6]
        self.camera.distance=10.8
        self.camera.azimuth=115
        self.camera.elevation=-48
        if self.restaurant:
            self.camera.lookat[:]=[*self.start_xy,.8]
            self.camera.distance=8.
            self.camera.azimuth=110
        self.vectors,self.v,self.u=pixel_vectors(4)
        self.frames={}
        self.max_scans=max_scans
        self.events=[]
        self.export_dir=None
        self.reset(strategy)

    def log(self,message):
        self.events.append({'scan':len(self.history),'message':message})
        self.events=self.events[-30:]

    def reset(self,strategy=None):
        self.strategy=strategy or getattr(self,'strategy','adaptive')
        self.map=OnlineMap(self.bounds)
        self.planner=Planner(self.nav,self.map,self.strategy)
        self.evaluator.seen[:]=False
        self.xy=self.start_xy.copy();self.yaw=0.;self.height=1.15;self.tilt=0.
        self.history=[];self.trace=[self.xy.tolist()];self.distance=0.;self.lift_distance=0.
        self.status='ready';self.phase='ready';self.reason=''
        self.target=None;self.path=[];self.stagnant=0;self.elapsed=0.
        self.events=[];self.export_dir=None
        self.frames.pop('ring',None)
        self.set_pose()
        self.render()
        self.log('场景就绪。等待开始扫描。')

    def set_pose(self):
        if not self.safety(*self.xy):
            raise RuntimeError('Robot pose violates conservative swept-cylinder clearance')
        if not (.55-1e-6<=self.height<=2.3+1e-6 and abs(self.tilt)<=.7):
            raise RuntimeError('Mast/camera joint limit violated')
        self.data.qpos[:]=[*self.xy,self.yaw,*([(self.height-.55)/4]*4),self.tilt]
        mujoco.mj_forward(self.model,self.data)

    def render(self):
        self.overview.update_scene(self.data,camera=self.camera,scene_option=self.overview_options)
        self.frames['overview']=jpeg(self.overview.render())

    def scan(self):
        before=self.map.known
        cloud_before=len(self.map.cloud)
        parts=[];endpoints=[]
        self.set_pose()
        # Depth is axial camera distance; back-project using each camera's true pose/intrinsics.
        for i in range(4):
            cam=self.model.camera(f'ring_{i}').id
            self.sensor.update_scene(self.data,camera=cam,scene_option=self.sensor_options)
            rgb=self.sensor.render().copy()
            self.sensor.enable_depth_rendering()
            depth=self.sensor.render().copy()
            self.sensor.disable_depth_rendering()
            z=depth[self.v,self.u]
            local=self.vectors*z[:,None]
            origin=self.data.cam_xpos[cam].copy()
            rotation=self.data.cam_xmat[cam].reshape(3,3)
            points=origin+local@rotation.T
            good=np.isfinite(z)&(z>.10)&(z<8.)
            # Exclude self returns using the actual compact robot footprint.
            radial=np.linalg.norm(points[:,:2]-self.xy,axis=1)
            good&=radial>.29
            points=points[good];colors=rgb[self.v,self.u][good]
            self.map.integrate(origin,points,colors)
            self.evaluator.observe(points,origin)
            endpoints.append(points);parts.append(rgb)
        points=np.concatenate(endpoints)
        self.frames['ring']=jpeg(np.concatenate(parts,axis=1))
        added=self.map.known-before
        new_surface_points=len(self.map.cloud)-cloud_before
        self.stagnant=self.stagnant+1 if added<8 and new_surface_points<100 else 0
        if self.target is not None:
            self.planner.visited.add(self.target.key)
        self.history.append({'scan':len(self.history)+1,'xy':self.xy.tolist(),'height':round(self.height,3),
                             'tilt_deg':round(math.degrees(self.tilt),1),'coverage':round(self.evaluator.coverage,3),
                             'known_voxels':self.map.known,'new_voxels':added,'cloud_points':len(self.map.cloud),
                             'new_surface_points':new_surface_points,
                             'distance_m':round(self.distance,3),'elapsed_s':round(self.elapsed,3),
                             'predicted_gain':self.target.gain if self.target else None})
        self.log(f'完成扫描 #{len(self.history)}：新增 {added} 个已知体素，相机高度 {self.height:.2f} m。')

    def plan(self):
        if len(self.history)>=self.max_scans:
            self.finish('scan_budget');return
        if self.stagnant>=6:
            self.finish('diminishing_returns');return
        target=self.planner.choose(self.xy,self.height,self.tilt)
        if target is None:
            self.finish('candidates_exhausted');return
        if target.gain<8:
            self.finish('low_expected_gain');return
        self.target=target
        self.path=[p.copy() for p in target.path[1:]]
        self.phase='adjusting' if np.linalg.norm(target.xy-self.xy)<.02 else 'moving'
        self.log(f'下一视角：({target.xy[0]:.1f}, {target.xy[1]:.1f})，{target.height:.2f} m，俯仰 {math.degrees(target.tilt):.0f}°；预估观测收益 {target.gain}。')

    def start(self):
        if self.status=='ready':
            self.status='running';self.phase='scanning'
            self.log('开始自主扫描。导航使用已知平面地图；视角收益只使用已观测体素。')
        elif self.status=='paused':
            self.status='running';self.log('继续扫描。')

    def finish(self,reason):
        self.status='completed';self.phase='completed';self.reason=reason
        self.log('扫描结束：'+reason+'。结果已保存；未承诺达到 100% 覆盖。')
        self.export()

    def tick(self,dt=.15):
        if self.status!='running':
            return
        self.elapsed+=dt
        if self.phase=='scanning':
            self.scan();self.phase='planning'
        elif self.phase=='planning':
            self.plan()
        elif self.phase=='moving':
            # Stow before translation; the full footprint remains obstacle-inflated at every height.
            if self.height>.56 or abs(self.tilt)>.01:
                self.move_joints(.55,0.,dt)
            elif self.path:
                goal=self.path[0];delta=goal-self.xy;length=np.linalg.norm(delta)
                heading=math.atan2(delta[1],delta[0]) if length>1e-7 else self.yaw
                error=(heading-self.yaw+math.pi)%(2*math.pi)-math.pi
                if abs(error)>.025:
                    self.yaw+=float(np.clip(error,-1.6*dt,1.6*dt))
                else:
                    amount=min(length,.65*dt)
                    next_xy=self.xy+delta/max(length,1e-9)*amount
                    if not self.nav.segment_safe(self.xy,next_xy):
                        raise RuntimeError('Swept path clearance failed')
                    self.xy=next_xy;self.distance+=amount
                    if amount>1e-7:
                        self.trace.append(self.xy.tolist())
                    if length<=amount+1e-6:
                        self.path.pop(0)
                self.set_pose()
            else:
                self.phase='adjusting'
        elif self.phase=='adjusting':
            error=(0.-self.yaw+math.pi)%(2*math.pi)-math.pi
            self.yaw+=float(np.clip(error,-1.6*dt,1.6*dt))
            self.move_joints(self.target.height,self.target.tilt,dt)
            if abs(error)<.025 and abs(self.height-self.target.height)<.005 and abs(self.tilt-self.target.tilt)<.005:
                self.yaw=0.;self.phase='scanning'
            self.set_pose()

    def move_joints(self,height,tilt,dt):
        step=float(np.clip(height-self.height,-.6*dt,.6*dt))
        self.height+=step;self.lift_distance+=abs(step)
        self.tilt+=float(np.clip(tilt-self.tilt,-.8*dt,.8*dt))
        self.set_pose()

    def state(self):
        return {'status':self.status,'phase':self.phase,'reason':self.reason,'strategy':self.strategy,
                'scene':self.scene_name,'scene_info':self.scene_info,'bounds':self.bounds,'candidate_count':len(self.nav.candidates),
                'xy':self.xy.tolist(),'yaw':self.yaw,'height':self.height,'tilt_deg':math.degrees(self.tilt),
                'coverage':round(self.evaluator.coverage,2),'reference_samples':len(self.evaluator.points),
                'coverage_parts':self.evaluator.breakdown(),
                'reference_area_m2':round(float(self.evaluator.weights.sum()),2),
                'known_voxels':self.map.known,'total_voxels':int(self.map.grid.size),'cloud_points':len(self.map.cloud),
                'scans':len(self.history),'max_scans':self.max_scans,'distance_m':round(self.distance,2),
                'lift_distance_m':round(self.lift_distance,2),'elapsed_s':round(self.elapsed,1),
                'target':None if self.target is None else {'xy':self.target.xy.tolist(),'height':self.target.height,'tilt_deg':math.degrees(self.target.tilt),'gain':self.target.gain},
                'path':[p.tolist() for p in self.path],'trace':self.trace[::max(1,len(self.trace)//600)],
                'history':self.history,'events':self.events[-12:],'candidates':self.planner.last_candidates,
                'layout':[] if self.restaurant else [{'name':b.name,'center':b.center,'half':b.half} for b in BOXES[6:]],
                'export_ready':self.export_dir is not None,'mode':'known_floorplan_kinematic_rgbd',
                'coverage_definition':'几何代理参考表面覆盖率；不是完整餐厅实测覆盖率。' if self.restaurant else '有限候选位姿下可见的参考表面样本，按面积加权；真值仅用于评估。'}

    def export(self):
        if self.export_dir is None:
            stamp=datetime.now(ZoneInfo('Asia/Shanghai')).strftime('%Y%m%d_%H%M%S_%f')
            self.export_dir=ROOT/'artifacts'/'runs'/stamp
        self.export_dir.mkdir(parents=True,exist_ok=True)
        points=list(self.map.cloud.values())
        with (self.export_dir/'cloud.ply').open('w') as f:
            f.write(f'ply\nformat ascii 1.0\nelement vertex {len(points)}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n')
            for p,c in points:
                f.write(' '.join([*(f'{v:.4f}' for v in p),*(str(int(v)) for v in c)])+'\n')
        (self.export_dir/'run.json').write_text(json.dumps(self.state(),ensure_ascii=False,indent=2)+'\n')
        for name,frame in self.frames.items():
            (self.export_dir/f'{name}.jpg').write_bytes(frame)
        np.savez_compressed(self.export_dir/'occupancy.npz',grid=self.map.grid,view_masks=self.map.view_masks,origin=self.map.origin,resolution=self.map.resolution)
        np.savez_compressed(self.export_dir/'evaluation.npz',points=self.evaluator.points,weights=self.evaluator.weights,seen=self.evaluator.seen,normals=self.evaluator.normals,labels=self.evaluator.labels)
        return str(self.export_dir)

    def cloud(self,limit=9000):
        values=list(self.map.cloud.values())
        stride=max(1,len(values)//limit)
        return [[round(float(x),3) for x in p]+[int(x) for x in c] for p,c in values[::stride]][:limit]

    def close(self):
        self.sensor.close();self.overview.close()
