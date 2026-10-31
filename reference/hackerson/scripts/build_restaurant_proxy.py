"""Build runtime navigation/render assets from the official Gaussian voxelization."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'/'python'))
sys.path.insert(0,str(ROOT/'scripts'))
import json
import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree
from PIL import Image
import trimesh
from prepare_restaurant import read_ply

A=ROOT/'assets'/'restaurant'


def decode_voxels(meta,binary):
    resolution=meta['voxelResolution']
    lo=np.array(meta['gridBounds']['min']);hi=np.array(meta['gridBounds']['max'])
    shape=np.rint((hi-lo)/resolution).astype(int)
    words=np.fromfile(binary,dtype='<u4')
    nodes=words[:meta['nodeCount']];leaves=words[meta['nodeCount']:]
    grid=np.zeros(shape,dtype=bool)
    def walk(index,origin,size,depth):
        word=int(nodes[index]);x,y,z=origin
        if word==0xff000000:
            grid[x:min(x+size,shape[0]),y:min(y+size,shape[1]),z:min(z+size,shape[2])]=True;return
        if word>>24==0:
            mask=int(leaves[word*2])|(int(leaves[word*2+1])<<32)
            for bit in range(64):
                if mask&(1<<bit):
                    cell=(x+(bit&3),y+((bit>>2)&3),z+((bit>>4)&3))
                    if all(cell[i]<shape[i] for i in range(3)):grid[cell]=True
            return
        children=word>>24;first=word&0xffffff;half=size//2;offset=0
        for octant in range(8):
            if children&(1<<octant):
                child=(x+(octant&1)*half,y+((octant>>1)&1)*half,z+((octant>>2)&1)*half)
                walk(first+offset,child,half,depth+1);offset+=1
    if len(nodes):walk(0,(0,0,0),4*(2**meta['treeDepth']),0)
    # Engine frame [x,y,z] -> simulation frame [x,-z,y], with Y voxel order reversed.
    return grid.transpose(0,2,1)[:,::-1,:].copy(),np.array([lo[0],-hi[2],lo[1]]),resolution


def main():
    meta=json.loads((A/'restaurant.voxel.json').read_text())
    solid,origin,res=decode_voxels(meta,A/'restaurant.voxel.bin')
    z=origin[2]+(np.arange(solid.shape[2])+.5)*res
    obstacles=np.any(solid[:,:,(z>.20)&(z<2.42)],axis=2)
    floor=np.any(solid[:,:,(z>-.15)&(z<.16)],axis=2)
    floor=ndimage.binary_closing(floor,iterations=3)
    floor=ndimage.binary_fill_holes(floor)
    distance=ndimage.distance_transform_edt(floor&~obstacles)*res
    free=distance>.34
    labels,count=ndimage.label(free)
    if not count:raise RuntimeError('No supported navigable space in restaurant voxelization')
    sizes=np.bincount(labels.ravel());sizes[0]=0
    reachable=labels==np.argmax(sizes)
    distance*=reachable
    start_cell=np.unravel_index(np.argmax(distance),distance.shape)
    start=origin[:2]+(np.array(start_cell)+.5)*res
    raw=read_ply(A/'cropped.ply')
    xyz=np.column_stack([raw['x'],raw['z'],-raw['y']+.07])
    colors=np.clip(.5+.28209479177387814*np.column_stack([raw[f'f_dc_{i}'] for i in range(3)]),0,1)
    tree=cKDTree(xyz)
    mesh=trimesh.load(A/'restaurant.collision.glb',force='mesh')
    vertices=np.asarray(mesh.vertices)[:,[0,2,1]]*np.array([1,-1,1])
    faces=np.asarray(mesh.faces).copy()
    centers=vertices[faces].mean(axis=1)
    _,nearest=tree.query(centers)
    rgb=(colors[nearest]*255).astype(np.uint8)
    side=int(np.ceil(np.sqrt(len(faces))))
    texture=np.zeros((side*2,side*2,3),dtype=np.uint8)
    for i,color in enumerate(rgb):
        row,col=divmod(i,side);texture[row*2:row*2+2,col*2:col*2+2]=color
    Image.fromarray(texture).save(A/'proxy_texture.png')
    for filename,cutaway in [('proxy.obj',False),('proxy_cutaway.obj',True)]:
        with (A/filename).open('w') as f:
            for p in vertices:f.write('v '+' '.join(f'{a:.5f}' for a in p)+'\n')
            for i in range(len(faces)):
                row,col=divmod(i,side)
                u=(col+.5)/side;v=1-(row+.5)/side
                f.write(f'vt {u:.7f} {v:.7f}\n')
            for i,face in enumerate(faces):
                if not cutaway or centers[i,2]<2.45:f.write('f '+' '.join(f'{v+1}/{i+1}' for v in face)+'\n')
    # Uniform area-weighted face sampling for a separate proxy-surface coverage metric.
    a,b,c=vertices[faces].transpose(1,0,2)
    cross=np.cross(b-a,c-a);area=np.linalg.norm(cross,axis=1)*.5
    rng=np.random.default_rng(20261030)
    valid=(area>1e-8)&(centers[:,2]>-.10)&(centers[:,2]<3.5)
    indices=np.flatnonzero(valid)
    pick=rng.choice(indices,size=min(16000,len(indices)),replace=True,p=area[indices]/area[indices].sum())
    uv=rng.random((len(pick),2));uv[uv.sum(axis=1)>1]=1-uv[uv.sum(axis=1)>1]
    points=a[pick]+uv[:,0,None]*(b-a)[pick]+uv[:,1,None]*(c-a)[pick]
    normals=cross[pick]/np.maximum(np.linalg.norm(cross[pick],axis=1,keepdims=True),1e-9)
    weight=np.full(len(points),area[indices].sum()/len(points))
    np.savez_compressed(A/'runtime.npz',solid=solid,origin=origin,resolution=res,floor=floor,obstacles=obstacles,reachable=reachable,clearance=distance,start=start,reference_points=points,reference_normals=normals,reference_weights=weight)
    summary={'name':'天安骏业集团餐厅','scene':'restaurant','source_gaussians':999131,'visual_gaussians':len(raw),'mesh_vertices':len(vertices),'mesh_triangles':len(faces),'voxel_resolution':res,'origin':origin.tolist(),'grid_shape':list(solid.shape),'start':start.tolist(),'reachable_area_m2':round(float(reachable.sum()*res*res),2),'start_clearance_m':round(float(distance[start_cell]),2),'bounds':[[float(origin[0]),float(origin[1]),0.],[float(origin[0]+solid.shape[0]*res),float(origin[1]+solid.shape[1]*res),3.5]],'raw_to_sim':'[x,z,-y+0.07]','scale_calibrated':False,'scale_note':'1 场景单位暂按 1 米，尚未实测标定','attribution':'天安骏业集团餐厅 — Hilo / superspl.at/scene/40c67340 / CC BY 4.0'}
    (A/'manifest.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(summary,ensure_ascii=False,indent=2))


if __name__=='__main__':main()
