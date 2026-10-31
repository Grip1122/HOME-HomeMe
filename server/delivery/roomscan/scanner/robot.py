"""Decorative crawler meshes; sensor/collision geometry and joint layout stay stable."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

ASSET = Path(__file__).resolve().parents[1] / 'assets' / 'robot'


def add_robot_visuals(xml):
    root=ET.fromstring(xml)
    asset=root.find('asset')
    robot=root.find('.//body[@name="robot"]')
    # Retain the original self-geometry for RGB-D and the existing swept envelope.
    # The detailed cosmetic meshes are visible only in the external overview.
    for geom in robot.iter('geom'):
        geom.set('group','2')
    manifest=json.loads((ASSET/'manifest.json').read_text())
    mapping={'Base':('robot',(0,0,-.12)),
             'WheelLeft':('robot',(.005,.128,.035)),
             'WheelRight':('robot',(.005,-.128,.035)),
             'WheelLeftFront':('robot',(.117,.128,-.047)),
             'WheelRightFront':('robot',(.117,-.128,-.047)),
             'WheelLeftRear':('robot',(-.117,.128,-.047)),
             'WheelRightRear':('robot',(-.117,-.128,-.047)),
             'CameraHead':('gimbal',(0,0,0)),
             **{f'MastStage{i}':(f'stage{i}',(0,0,0)) for i in range(1,5)}}
    for component,meshes in manifest['components'].items():
        body_name,pos=mapping[component]
        body=root.find(f'.//body[@name="{body_name}"]')
        for entry in meshes:
            name='rs01_'+entry['mesh']
            ET.SubElement(asset,'mesh',name=name,file=str(ASSET/'meshes'/(entry['mesh']+'.obj')),maxhullvert='32')
            ET.SubElement(body,'geom',name=name,type='mesh',mesh=name,pos=' '.join(map(str,pos)),
                          rgba=' '.join(map(str,entry['rgba'])),group='5',contype='0',conaffinity='0',density='0')
    return ET.tostring(root,encoding='unicode')
