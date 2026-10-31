"""Restaurant scene adapter: actual Gaussian asset + independent voxel collision proxy."""
from pathlib import Path
import json
import numpy as np
import mujoco
from scipy.spatial import cKDTree
from .world import Navigation, scene_xml, HEIGHTS
from .mapping import SurfaceEvaluator

ASSET=Path(__file__).resolve().parents[1]/'assets'/'restaurant'


class Restaurant:
    def __init__(self):
        self.meta=json.loads((ASSET/'manifest.json').read_text())
        self.data=np.load(ASSET/'runtime.npz')
        self.origin=self.data['origin'];self.res=float(self.data['resolution'])
        self.clearance=self.data['clearance'];self.reachable=self.data['reachable']
        self.start=self.data['start'].copy()
        self.bounds=self.meta['bounds']

    def safe(self,x,y,margin=.04):
        cell=np.floor((np.array([x,y])-self.origin[:2])/self.res).astype(int)
        if not ((cell>=0)&(cell<self.clearance.shape)).all():return False
        return bool(self.clearance[tuple(cell)]>.25+margin+self.res*.71)

    def navigation(self):
        xs=self.origin[0]+(np.arange(self.clearance.shape[0])+.5)*self.res
        ys=self.origin[1]+(np.arange(self.clearance.shape[1])+.5)*self.res
        candidates=[]
        # Spread candidates through the supported reachable floor, with safe grid snapping.
        allowed=np.argwhere(self.clearance>.48)
        points=self.origin[:2]+(allowed+.5)*self.res
        tree=cKDTree(points)
        for x in np.arange(xs[0],xs[-1],1.45):
            for y in np.arange(ys[0],ys[-1],1.45):
                distance,index=tree.query([x,y])
                point=points[index]
                if distance<.8 and self.safe(*point,.12) and all(np.linalg.norm(point-p)>1.15 for p in candidates):candidates.append(point)
        nav=Navigation(xs,ys,self.safe,candidates,self.segment_safe)
        field=nav.distances(self.start)
        nav.candidates=[p for p in candidates if nav.cell(p) in field[0]]
        if not nav.candidates:raise RuntimeError('No connected restaurant scan candidates')
        return nav

    def segment_safe(self,a,b):
        """Exact 2-D supercover traversal; sampling can miss a clipped voxel corner."""
        a=np.asarray(a);b=np.asarray(b)
        if not self.safe(*a) or not self.safe(*b):return False
        cell=np.floor((a-self.origin[:2])/self.res).astype(int)
        end=np.floor((b-self.origin[:2])/self.res).astype(int)
        delta=b-a;step=np.sign(delta).astype(int)
        tdelta=np.divide(self.res,np.abs(delta),out=np.full(2,np.inf),where=np.abs(delta)>1e-12)
        boundary=self.origin[:2]+(cell+(step>0))*self.res
        tmax=np.divide(boundary-a,delta,out=np.full(2,np.inf),where=np.abs(delta)>1e-12)
        def clear(c):
            return ((c>=0)&(c<self.clearance.shape)).all() and self.clearance[tuple(c)]>.29+self.res*.71
        for _ in range(sum(self.clearance.shape)+4):
            if not clear(cell):return False
            if np.array_equal(cell,end):return True
            if abs(tmax[0]-tmax[1])<1e-10:
                if not clear(cell+[step[0],0]) or not clear(cell+[0,step[1]]):return False
                cell+=step;tmax+=tdelta
            else:
                axis=int(np.argmin(tmax));cell[axis]+=step[axis];tmax[axis]+=tdelta[axis]
        return False

    def xml(self):
        assets=f'<mesh name="restaurant" file="{ASSET / "proxy.obj"}" maxhullvert="64"/><mesh name="restaurant_cutaway" file="{ASSET / "proxy_cutaway.obj"}" maxhullvert="64"/><texture name="restaurant_color" type="2d" file="{ASSET / "proxy_texture.png"}"/><material name="restaurant_material" texture="restaurant_color" specular="0" shininess="0"/>'
        environment='<geom name="restaurant_proxy" type="mesh" mesh="restaurant" material="restaurant_material" contype="0" conaffinity="0" group="3"/><geom name="restaurant_cutaway" type="mesh" mesh="restaurant_cutaway" material="restaurant_material" contype="0" conaffinity="0" group="4"/>'
        return scene_xml(environment,assets)

    def evaluator(self,model,data,viewpoints):
        signature=self.reference_signature(viewpoints)
        cache=ASSET/'reference_visible.npz'
        if cache.exists():
            with np.load(cache) as saved:
                if str(saved['signature'])==signature:return self.make_evaluator(saved['points'],saved['normals'],saved['weights'])
        points=self.data['reference_points'];normals=self.data['reference_normals'];weights=self.data['reference_weights']
        visible=np.zeros(len(points),dtype=bool)
        geomgroup=np.ones(6,dtype=np.uint8)
        geomgroup[4]=0
        # mj_ray excludes the robot body (and descendants): offline visibility, not planner input.
        robot=model.body('robot').id
        geomid=np.zeros(1,dtype=np.int32)
        for point in viewpoints:
            for height in (1.15,2.3):
                origin=np.r_[point,height]
                indices=np.flatnonzero(~visible)
                delta=points[indices]-origin
                length=np.linalg.norm(delta,axis=1)
                facing=np.sum(normals[indices]*(-delta),axis=1)>0
                possible=(length>.25)&(length<7.8)&facing
                for index,direction,distance in zip(indices[possible],delta[possible],length[possible]):
                    hit=mujoco.mj_ray(model,data,origin,direction/distance,geomgroup,1,robot,geomid)
                    if hit>=distance-.14 and hit<=distance+.14:visible[index]=True
        np.savez_compressed(cache,signature=signature,points=points[visible],normals=normals[visible],weights=weights[visible])
        return self.make_evaluator(points[visible],normals[visible],weights[visible])

    def reference_signature(self,viewpoints):
        return f'v1:{(ASSET/"runtime.npz").stat().st_mtime_ns}:{(ASSET/"proxy.obj").stat().st_mtime_ns}:'+repr([p.tolist() for p in viewpoints])

    @staticmethod
    def make_evaluator(points,normals,weights):
        evaluator=SurfaceEvaluator.__new__(SurfaceEvaluator)
        evaluator.points=points.copy();evaluator.normals=normals.copy();evaluator.weights=weights.copy()
        evaluator.labels=np.full(len(points),'restaurant_proxy')
        evaluator.seen=np.zeros(len(points),dtype=bool)
        evaluator.tree=cKDTree(evaluator.points)
        if not len(evaluator.points):raise RuntimeError('Restaurant proxy visibility reference is empty')
        return evaluator

    def public(self):
        # Compact map: free intervals per row; no huge per-frame 3D geometry payload.
        cells=np.argwhere(self.reachable)
        return self.meta|{'candidate_units':'metres_assumed','floor_cells':(self.origin[:2]+(cells[::max(1,len(cells)//5000)]+.5)*self.res).round(3).tolist(),'floor_cell_size':self.res,'visual_url':'/assets/restaurant/restaurant_cutaway.compressed.ply','full_visual_url':'/assets/restaurant/restaurant.compressed.ply'}
