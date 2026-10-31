"""Sensor-only online occupancy and a separate truth-based evaluation layer."""
import numpy as np
from scipy.spatial import cKDTree
from .world import BOXES, HEIGHTS, rotation, camera_axes

WIDTH, HEIGHT = 160, 120
FOCAL = HEIGHT / (2*np.tan(np.deg2rad(75)/2))


def pixel_vectors(stride=4):
    v,u=np.mgrid[stride//2:HEIGHT:stride,stride//2:WIDTH:stride]
    return np.stack(((u+.5-WIDTH/2)/FOCAL,-(v+.5-HEIGHT/2)/FOCAL,-np.ones_like(u)),axis=-1).reshape(-1,3),v.ravel(),u.ravel()


class OnlineMap:
    resolution=.2
    origin=np.array([-4.,-3.,0.])
    shape=(40,30,14)

    def __init__(self, bounds=None):
        if bounds is not None:
            self.origin=np.asarray(bounds[0],dtype=float)
            self.shape=tuple(np.ceil((np.asarray(bounds[1])-self.origin)/self.resolution).astype(int))
        self.grid=np.zeros(self.shape,dtype=np.uint8)  # 0 unknown, 1 free, 2 occupied
        self.view_masks=np.zeros(self.shape,dtype=np.uint8)
        self.cloud={}
        self.directions=pixel_vectors(16)[0]

    def indices(self, points):
        return np.floor((points-self.origin)/self.resolution).astype(int)

    def valid(self, cells):
        return ((cells>=0)&(cells<np.array(self.shape))).all(axis=-1)

    def integrate(self, origin, endpoints, colors):
        delta=endpoints-origin
        lengths=np.linalg.norm(delta,axis=1)
        good=(lengths>.16)&(lengths<8.)&np.isfinite(lengths)
        endpoints,colors,delta,lengths=endpoints[good],colors[good],delta[good],lengths[good]
        if not len(endpoints):
            return
        # Sample free space strictly before the observed surface. Never overwrite occupied evidence.
        distances=np.arange(.1,8.,self.resolution*.65)
        rays=origin+delta[:,None,:]/lengths[:,None,None]*distances[None,:,None]
        cells=self.indices(rays)
        valid=self.valid(cells)&(distances[None,:]<lengths[:,None]-.12)
        flat=cells[valid]
        if len(flat):
            ix=tuple(flat.T)
            self.grid[ix]=np.maximum(self.grid[ix],1)
        hits=self.indices(endpoints)
        # Wall/floor hits on the room boundary are put into the adjacent interior voxel.
        near=((endpoints>=self.origin-.03)&(endpoints<=self.origin+np.array(self.shape)*self.resolution+.03)).all(axis=1)
        hits=np.clip(hits,0,np.array(self.shape)-1)
        self.grid[tuple(hits[near].T)]=2
        view=origin-endpoints
        axis=np.argmax(np.abs(view),axis=1)
        codes=axis*2+(view[np.arange(len(view)),axis]>0)
        np.bitwise_or.at(self.view_masks,tuple(hits[near].T),(1<<codes[near]).astype(np.uint8))
        for p,c in zip(endpoints,colors):
            if np.all(p>=self.origin-.05) and np.all(p<=self.origin+np.array(self.shape)*self.resolution+.05):
                self.cloud[tuple(np.floor(p/.07).astype(int))]=(p.copy(),c.copy())

    def expected_gain(self, xy, height, tilt):
        """Ray march ONLY the observed voxel grid; no world geometry/truth access."""
        rot=rotation(0.,tilt)
        all_unknown=[]
        new_surface_views=[]
        for camera in range(4):
            fwd,axes=camera_axes(camera)
            origin=np.r_[xy,height]+rot@(fwd*.105)
            rays=self.directions@axes.T@rot.T
            rays/=np.linalg.norm(rays,axis=1,keepdims=True)
            steps=np.arange(.2,8.1,.2)
            cells=self.indices(origin+rays[:,None,:]*steps[None,:,None])
            valid=self.valid(cells)
            clipped=np.clip(cells,0,np.array(self.shape)-1)
            values=self.grid[tuple(clipped.reshape(-1,3).T)].reshape(valid.shape)
            blocked=(values==2)|~valid
            visible=np.cumsum(blocked,axis=1)==0
            unknown=visible&(values==0)&valid
            if unknown.any():
                all_unknown.append(np.ravel_multi_index(tuple(cells[unknown].T),self.shape))
            # A known surface observed from a new coarse direction also has value.
            # This quality term uses observed hits and viewing history, never evaluator truth.
            first=np.argmax(blocked,axis=1)
            rows=np.arange(len(rays))
            hit_cells=clipped[rows,first]
            hit_valid=valid[rows,first]&(values[rows,first]==2)
            view=-rays
            axis=np.argmax(np.abs(view),axis=1)
            codes=axis*2+(view[rows,axis]>0)
            masks=self.view_masks[tuple(hit_cells.T)]
            unseen=hit_valid&((masks&(1<<codes))==0)
            if unseen.any():
                new_surface_views.append(np.ravel_multi_index(tuple(hit_cells[unseen].T),self.shape)*6+codes[unseen])
        exploration=len(np.unique(np.concatenate(all_unknown))) if all_unknown else 0
        inspection=len(np.unique(np.concatenate(new_surface_views))) if new_surface_views else 0
        return exploration+3*inspection

    @property
    def known(self):
        return int(np.count_nonzero(self.grid))


class SurfaceEvaluator:
    """Offline reference visibility. Never passed to or queried by the planner.

    Denominator is area-weighted exposed samples visible from the finite candidate
    viewpoint set, not a proof of all physically observable surfaces.
    """
    def __init__(self, viewpoints, spacing=.16):
        points,weights,normals,labels=[],[],[],[]
        for box in BOXES:
            center,half=np.array(box.center),np.array(box.half)
            for axis in range(3):
                other=[a for a in range(3) if a!=axis]
                counts=[max(1,int(np.ceil(2*half[a]/spacing))) for a in other]
                area=4*half[other[0]]*half[other[1]]/(counts[0]*counts[1])
                for sign in (-1,1):
                    coords=[np.linspace(center[a]-half[a],center[a]+half[a],n,endpoint=False)+half[a]/n for a,n in zip(other,counts)]
                    uu,vv=np.meshgrid(*coords,indexing='ij')
                    face=np.tile(center,(uu.size,1))
                    face[:,axis]+=sign*half[axis]
                    face[:,other[0]]=uu.ravel();face[:,other[1]]=vv.ravel()
                    inside=((face[:,0]>=-4)&(face[:,0]<=4)&(face[:,1]>=-3)&(face[:,1]<=3)&(face[:,2]>=0)&(face[:,2]<=2.8))
                    points.extend(face[inside]);weights.extend([area]*int(inside.sum()))
                    normal=np.zeros(3);normal[axis]=sign
                    normals.extend([normal.copy()]*int(inside.sum()))
                    labels.extend([box.name]*int(inside.sum()))
        points=np.array(points);weights=np.array(weights);normals=np.array(normals)
        visible=np.zeros(len(points),dtype=bool)
        for xy in viewpoints:
            for height in HEIGHTS:
                pending=np.flatnonzero(~visible)
                if not len(pending):
                    break
                origin=np.r_[xy,height]
                targets=points[pending]
                delta=targets-origin
                length=np.linalg.norm(delta,axis=1)
                clear=(length>.2)&(length<7.8)
                for box in BOXES:
                    lo=np.array(box.center)-box.half
                    hi=np.array(box.center)+box.half
                    parallel=np.abs(delta)<1e-9
                    inv=np.divide(1.,delta,out=np.zeros_like(delta),where=~parallel)
                    t1=(lo-origin)*inv;t2=(hi-origin)*inv
                    low=np.where(parallel,-np.inf,np.minimum(t1,t2))
                    high=np.where(parallel,np.inf,np.maximum(t1,t2))
                    miss=(parallel&((origin<lo)|(origin>hi))).any(axis=1)
                    enter=np.max(low,axis=1);leave=np.min(high,axis=1)
                    occluded=~miss&(leave>=np.maximum(enter,0))&(enter<1-.025/np.maximum(length,.01))&(leave>1e-5)
                    clear&=~occluded
                visible[pending[clear]]=True
        self.points=points[visible]
        self.weights=weights[visible]
        self.normals=normals[visible]
        self.labels=np.array(labels)[visible]
        self.seen=np.zeros(len(self.points),dtype=bool)
        self.tree=cKDTree(self.points)

    def observe(self, endpoints, origin):
        # Mark reference samples close to actual depth hits, not merely their estimated view frustum.
        neighbors=self.tree.query_ball_point(endpoints,.125)
        counts=np.fromiter(map(len,neighbors),dtype=int,count=len(neighbors))
        if not counts.sum():
            return
        indices=np.concatenate([n for n in neighbors if len(n)])
        hits=np.repeat(endpoints,counts,axis=0)
        reference=self.points[indices];normals=self.normals[indices]
        plane_distance=np.abs(np.sum((hits-reference)*normals,axis=1))
        front_facing=np.sum((origin-reference)*normals,axis=1)>.02
        self.seen[indices[(plane_distance<.035)&front_facing]]=True

    @property
    def coverage(self):
        return float(self.weights[self.seen].sum()/self.weights.sum()*100) if len(self.weights) else 0.

    def breakdown(self):
        result={}
        for name in np.unique(self.labels):
            mask=self.labels==name
            result[str(name)]=round(float(self.weights[mask&self.seen].sum()/self.weights[mask].sum()*100),2)
        return result
