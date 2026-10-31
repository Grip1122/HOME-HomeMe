"""Prepare the restaurant source without changing the original Gaussian PLY."""
from pathlib import Path
import json
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
ASSET=ROOT/'assets'/'restaurant'


def read_ply(path):
    with path.open('rb') as f:
        fields=[];count=0
        while True:
            line=f.readline().decode('ascii').strip()
            if line.startswith('element vertex '):count=int(line.split()[-1])
            if line.startswith('property float '):fields.append((line.split()[-1],'<f4'))
            if line=='end_header':offset=f.tell();break
    return np.memmap(path,dtype=fields,mode='r',offset=offset,shape=(count,))


def write_ply(path,source,mask):
    names=['x','y','z','rot_0','rot_1','rot_2','rot_3','scale_0','scale_1','scale_2','opacity','f_dc_0','f_dc_1','f_dc_2']
    data=np.empty(int(mask.sum()),dtype=[(n,'<f4') for n in names])
    for name in names:data[name]=source[name][mask]
    header='ply\nformat binary_little_endian 1.0\n'+f'element vertex {len(data)}\n'+''.join(f'property float {n}\n' for n in names)+'end_header\n'
    with path.open('wb') as f:f.write(header.encode());data.tofile(f)


def main():
    source=read_ply(ASSET/'scene.ply')
    xyz=np.column_stack([source[n] for n in 'xyz'])
    mask=np.isfinite(xyz).all(axis=1)&((xyz>[-11,-3.35,-6])&(xyz<[10,.35,10])).all(axis=1)
    mask&=source['opacity']>-3.9
    write_ply(ASSET/'cropped.ply',source,mask)
    write_ply(ASSET/'cutaway.ply',source,mask&(xyz[:,1]>-2.45))
    print(json.dumps({'source':len(source),'cropped':int(mask.sum()),'cutaway':int((mask&(xyz[:,1]>-2.45)).sum()),'raw_to_sim':'[x,z,-y+0.07]','scale':'1 scene unit assumed 1 metre; not calibrated'},indent=2))


if __name__=='__main__':main()
