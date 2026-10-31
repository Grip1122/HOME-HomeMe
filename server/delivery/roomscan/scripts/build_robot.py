"""Create a reusable articulated GLB and matching MuJoCo visual meshes.

Run with PYTHONPATH=tools/python python3 scripts/build_robot.py.
Crawler geometry is modeled here; visual reference: chillibasket/walle-replica.
All design coordinates here are meters, X forward, Z up, as in the simulator.
"""
from collections import defaultdict
from pathlib import Path
import json
import math
import numpy as np
import trimesh as tm
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'robot'
PC = np.array([[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]],dtype=float)
PARTS = defaultdict(list)
TRACK_PROFILE = []
TREADS = []
MATERIALS = {
    'ochre': ('#DCA547', .45, .32),
    'gold_edge': ('#F2CC79', .6, .29),
    'graphite': ('#20292D', .28, .42),
    'rubber': ('#10171B', .0, .82),
    'alloy': ('#A9B8BC', .82, .26),
    'dark_alloy': ('#52656B', .75, .32),
    'ivory': ('#E9E4D6', .18, .44),
    'glass': ('#102E44', .7, .12),
    'lens_blue': ('#266582', .62, .16),
    'mint': ('#67E6C5', .2, .27),
    'red': ('#DF7059', .1, .42),
}


def color(key):
    text=MATERIALS[key][0].lstrip('#')
    return [int(text[i:i+2],16) for i in (0,2,4)]+[255]


def add(group, mesh, mat, pos=(0,0,0)):
    mesh.apply_translation(pos)
    PARTS[group].append((mat,mesh))


def box(group, size, pos, mat, bevel=.004):
    # A small rounded chamfer catches light, without external mesh dependencies.
    half=np.asarray(size)/2
    bevel=min(bevel,min(half)*.45)
    directions=np.r_[np.eye(3),-np.eye(3)]
    points=[np.array([x,y,z])*(half-bevel)+d*bevel
            for x in (-1,1) for y in (-1,1) for z in (-1,1) for d in directions]
    add(group,tm.convex.convex_hull(points),mat,pos)


def cyl(group, radius, height, pos, mat, axis=(0,0,1), sections=48):
    mesh=tm.creation.cylinder(radius=radius,height=height,sections=sections)
    mesh.apply_transform(tm.geometry.align_vectors([0,0,1],axis))
    add(group,mesh,mat,pos)


def ring(group, radius, tube, pos, mat, axis=(0,0,1)):
    mesh=tm.creation.torus(major_radius=radius,minor_radius=tube,major_sections=48,minor_sections=8)
    mesh.apply_transform(tm.geometry.align_vectors([0,0,1],axis))
    add(group,mesh,mat,pos)


def bolt(group,pos,axis=(0,0,1),radius=.003):
    cyl(group,radius,.002,pos,'alloy',axis,sections=6)


def track_outline(radius):
    centers=np.array([[-.117,.073],[.117,.073],[.005,.155]])
    points=[]
    for i,center in enumerate(centers):
        previous=center-centers[(i-1)%3];following=centers[(i+1)%3]-center
        n0=np.array([previous[1],-previous[0]]);n1=np.array([following[1],-following[0]])
        a=math.atan2(n0[1],n0[0]);b=math.atan2(n1[1],n1[0]);span=(b-a)%(2*math.pi)
        for angle in np.linspace(a,a+span,max(3,round(span*14))):
            points.append(center+radius*np.array([math.cos(angle),math.sin(angle)]))
    return np.array(points)


def path_pose(distance):
    points=np.asarray(TRACK_PROFILE);segments=np.roll(points,-1,axis=0)-points
    lengths=np.linalg.norm(segments,axis=1);distance=distance%sum(lengths)
    for point,segment,length in zip(points,segments,lengths):
        if distance<=length:return point+segment*(distance/length),math.atan2(segment[1],segment[0])
        distance-=length
    raise AssertionError('Track path overflow')


def chassis():
    # Compact triangular crawler undercarriage, inspired by the supplied WALL-E.
    # Entire visible base remains inside the existing 0.25 m navigation envelope.
    box('Base',(.252,.204,.184),(0,0,.265),'ochre',.014)
    box('Base',(.268,.216,.020),(0,0,.362),'gold_edge',.008)
    box('Base',(.256,.209,.016),(0,0,.174),'graphite',.005)
    box('Base',(.122,.122,.014),(0,0,.379),'graphite',.005)
    for x in (-.05,.05):
        for y in (-.05,.05):bolt('Base',(x,y,.388),radius=.0035)
    # Front hatch, grille, lights and exposed fasteners give the body a face.
    box('Base',(.008,.158,.100),(.129,0,.263),'dark_alloy',.005)
    box('Base',(.009,.149,.089),(.134,0,.261),'ochre',.005)
    box('Base',(.011,.113,.033),(.14,0,.291),'graphite',.003)
    for z in np.linspace(.281,.302,4):box('Base',(.002,.104,.003),(.146,0,z),'dark_alloy',.0005)
    for side in (-1,1):
        cyl('Base',.013,.005,(.142,side*.052,.236),'gold_edge',axis=(1,0,0),sections=24)
        cyl('Base',.008,.006,(.146,side*.052,.236),'glass',axis=(1,0,0),sections=24)
        bolt('Base',(.14,side*.066,.32),axis=(1,0,0))
        bolt('Base',(.14,side*.066,.218),axis=(1,0,0))
        # Short armored side panels; no decorative arms to obstruct the mast.
        box('Base',(.175,.009,.067),(-.012,side*.107,.292),'ochre',.006)
        for x in (-.082,.061):bolt('Base',(x,side*.113,.303),axis=(0,side,0))
        for i in range(5):box('Base',(.007,.002,.032),(-.048+i*.018,side*.114,.287),'graphite',.001)
        box('Base',(.007,.030,.008),(.133,side*.079,.337),'mint',.001)
    box('Base',(.008,.069,.013),(-.131,0,.24),'red',.002)
    # Two inset steel belly axles.
    for x in (-.092,.092):cyl('Base',.017,.262,(x,0,.13),'dark_alloy',axis=(0,1,0))
    TRACK_PROFILE.extend(track_outline(.062).tolist())
    outside=track_outline(.062);inside=track_outline(.050);count=len(outside)
    for side,label in [(1,'Left'),(-1,'Right')]:
        y=side*.128
        verts=np.array([[x,y+offset,z] for offset in (-.024,.024) for curve in (outside,inside) for x,z in curve])
        faces=[]
        for i in range(count):
            j=(i+1)%count
            for a,b,c,d in [(i,j,count+j,count+i),(2*count+i,3*count+i,3*count+j,2*count+j),
                              (i,2*count+i,2*count+j,j),(count+i,count+j,3*count+j,3*count+i)]:
                faces.extend([(a,b,c),(a,c,d)])
        belt=tm.Trimesh(vertices=verts,faces=faces);belt.fix_normals();add('Base',belt,'rubber')
        # Three independently articulated wheel centers on each track.
        for suffix,x,z,radius in [('Front',.117,.073,.052),('Rear',-.117,.073,.052),('',.005,.155,.049)]:
            name='Wheel'+label+suffix
            cyl(name,radius,.042,(0,0,0),'dark_alloy',axis=(0,1,0))
            cyl(name,radius*.76,.045,(0,0,0),'ochre',axis=(0,1,0))
            cyl(name,radius*.46,.047,(0,0,0),'graphite',axis=(0,1,0))
            cyl(name,radius*.22,.049,(0,0,0),'alloy',axis=(0,1,0))
            for a in np.linspace(0,2*math.pi,6,endpoint=False):
                bolt(name,(radius*.6*math.cos(a),side*.024,radius*.6*math.sin(a)),axis=(0,side,0),radius=.0025)
        length=sum(np.linalg.norm(np.roll(outside,-1,axis=0)-outside,axis=1))
        for i in range(42):
            point,angle=path_pose(i*length/42)
            TREADS.append((f'Tread{label}{i:02d}',[point[0],y,point[1]],angle))


def mast():
    # Fixed sleeve plus four nested sections: same limits and hierarchy as MuJoCo.
    box('Base',(.092,.092,.305),(0,0,.388),'graphite',.009)
    box('Base',(.096,.096,.018),(0,0,.54),'ochre',.006)
    for side in (-1,1):
        box('Base',(.002,.036,.245),(.047*side,0,.385),'dark_alloy',.001)
    for stage,radius in enumerate((.038,.030,.023,.016),start=1):
        group='MastStage'+str(stage)
        cyl(group,radius,.46,(0,0,-.23),'alloy')
        # Guide strips and independent clamp collars make the telescoping visible.
        box(group,(.004,.008,.43),(radius,0,-.235),'dark_alloy',.001)
        cyl(group,radius+.004,.018,(0,0,-.009),'graphite')
        ring(group,radius+.003,.002,(0,0,-.002),'gold_edge')
    cyl('CameraHead',.03,.045,(0,0,-.048),'dark_alloy')
    cyl('CameraHead',.025,.062,(0,0,-.037),'ochre',axis=(0,1,0))
    for side in (-1,1):
        cyl('CameraHead',.019,.005,(0,side*.034,-.037),'graphite',axis=(0,1,0))
        bolt('CameraHead',(0,side*.038,-.037),axis=(0,side,0),radius=.005)


def camera_head():
    box('CameraHead',(.15,.153,.060),(-.012,0,.004),'ochre',.012)
    box('CameraHead',(.096,.125,.012),(-.018,0,.041),'ivory',.004)
    # Friendly binocular housing inspired by the supplied WALL-E reference.
    # The four simulated scan cameras keep their original 0.105 m offsets.
    for side in (-1,1):
        center=(.027,side*.055,.008)
        box('CameraHead',(.106,.101,.102),center,'ochre',.015)
        cyl('CameraHead',.047,.014,(.083,side*.055,.008),'graphite',axis=(1,0,0))
        ring('CameraHead',.043,.003,(.092,side*.055,.008),'gold_edge',axis=(1,0,0))
        cyl('CameraHead',.037,.007,(.094,side*.055,.008),'glass',axis=(1,0,0))
        ring('CameraHead',.028,.0014,(.098,side*.055,.008),'lens_blue',axis=(1,0,0))
        cyl('CameraHead',.022,.002,(.099,side*.055,.008),'lens_blue',axis=(1,0,0))
        cyl('CameraHead',.014,.002,(.101,side*.055,.008),'glass',axis=(1,0,0))
        # Glints are geometry, so the glass reads clearly even without an HDR map.
        cyl('CameraHead',.005,.001,(.102,side*.055-.009,.020),'ivory',axis=(1,0,0),sections=16)
        for z in (-.029,.045):bolt('CameraHead',(.085,side*.094,z),axis=(1,0,0),radius=.0022)
    # Side and rear fisheye modules provide the visual 360-degree sensor ring.
    for a in (math.pi/2,math.pi,3*math.pi/2):
        f=np.array([math.cos(a),math.sin(a),0])
        cyl('CameraHead',.027,.032,f*.087,'graphite',axis=f)
        ring('CameraHead',.023,.002,f*.103,'gold_edge',axis=f)
        cyl('CameraHead',.020,.003,f*.105,'glass',axis=f)
        cyl('CameraHead',.010,.003,f*.107,'lens_blue',axis=f,sections=24)
    cyl('CameraHead',.006,.002,(-.032,0,.05),'mint',sections=24)


def export():
    scene=tm.Scene(base_frame='RoomScanRobot')
    hierarchy={'Base':('RoomScanRobot',(0,0,0)),
               'WheelLeft':('Base',(.005,.128,.155)),
               'WheelRight':('Base',(.005,-.128,.155)),
               'WheelLeftFront':('Base',(.117,.128,.073)),
               'WheelRightFront':('Base',(.117,-.128,.073)),
               'WheelLeftRear':('Base',(-.117,.128,.073)),
               'WheelRightRear':('Base',(-.117,-.128,.073)),
               'MastStage1':('Base',(0,0,.55)),
               'MastStage2':('MastStage1',(0,0,0)),
               'MastStage3':('MastStage2',(0,0,0)),
               'MastStage4':('MastStage3',(0,0,0)),
               'CameraHead':('MastStage4',(0,0,0))}
    for name,(parent,pos) in hierarchy.items():
        scene.graph.update(frame_to=name,frame_from=parent,matrix=tm.transformations.translation_matrix(PC[:3,:3]@pos))
    (OUT/'meshes').mkdir(exist_ok=True)
    manifest={'name':'RoomScan RS-01 Crawler','version':2,'source':{
        'visual_reference':'https://github.com/chillibasket/walle-replica',
        'geometry':'Procedurally modeled in scripts/build_robot.py; no external mesh in this crawler variant.',
        'design':'Dual triangular crawler tracks, ochre service body, four-stage mast, binocular-style ring camera.'},
        'coordinates':'GLB: X forward, Y up, Z right; MJCF: X forward, Y left, Z up',
        'footprint_radius_m':.25,'camera_height_limits_m':[.55,2.3],
        'camera_tilt_limits_rad':[-.7,.7],'components':{},
        'tracks':{'profile':TRACK_PROFILE,'links_per_side':42,'center_y_m':.128,'drive_radius_m':.049,'roller_radius_m':.052}}
    tread=tm.util.concatenate([tm.creation.box((.014,.060,.009)),
                              tm.creation.box((.004,.062,.003),transform=tm.transformations.translation_matrix((0,0,.005)))])
    frozen_treads=[]
    for name,pos,angle in TREADS:
        transform=tm.transformations.translation_matrix(pos)@tm.transformations.rotation_matrix(-angle,[0,1,0])
        frozen=tread.copy();frozen.apply_transform(transform);frozen_treads.append(frozen)
    for name,items in PARTS.items():
        by_material=defaultdict(list)
        for mat,mesh in items:by_material[mat].append(mesh)
        manifest['components'][name]=[]
        for mat,meshes in by_material.items():
            mesh=tm.util.concatenate(meshes)
            asset_name=f'{name}_{mat}'
            # Both renderers use exactly the same component geometry.
            mjmesh=tm.util.concatenate([mesh,*frozen_treads]) if name=='Base' and mat=='graphite' else mesh
            (OUT/'meshes'/f'{asset_name}.obj').write_text(tm.exchange.obj.export_obj(mjmesh,include_texture=False,include_color=False))
            manifest['components'][name].append({'mesh':asset_name,'rgba':np.round(np.array(color(mat))/255,5).tolist()})
            browser_mesh=mesh.copy()
            browser_mesh.apply_transform(PC)
            hexcolor,metal,rough=MATERIALS[mat]
            browser_mesh.visual=tm.visual.TextureVisuals(material=PBRMaterial(name=mat,baseColorFactor=color(mat),metallicFactor=metal,roughnessFactor=rough,
                emissiveFactor=[.06,.20,.15] if mat=='mint' else [0,0,0]))
            scene.add_geometry(browser_mesh,node_name=asset_name,geom_name=asset_name,parent_node_name=name)
    tread_pc=tread.copy();tread_pc.apply_transform(PC)
    tread_pc.visual=tm.visual.TextureVisuals(material=PBRMaterial(name='tread_steel',baseColorFactor=color('graphite'),metallicFactor=.32,roughnessFactor=.58))
    for name,pos,angle in TREADS:
        transform=tm.transformations.translation_matrix(PC[:3,:3]@pos)@tm.transformations.rotation_matrix(angle,[0,0,1])
        scene.add_geometry(tread_pc,node_name=name,geom_name='TreadLink',parent_node_name='Base',transform=transform)
    scene.export(OUT/'roomscan-rs01.glb')
    manifest['triangles']=sum(len(mesh.faces) for items in PARTS.values() for _,mesh in items)+len(TREADS)*len(tread.faces)
    manifest['glb_bytes']=(OUT/'roomscan-rs01.glb').stat().st_size
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:manifest[k] for k in ('name','triangles','glb_bytes')},ensure_ascii=False))


if __name__=='__main__':
    chassis();mast();camera_head();export()
