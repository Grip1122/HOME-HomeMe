import json
from pathlib import Path
import struct
import re

ROOT=Path(__file__).resolve().parents[1]


def test_robot_delivery_uses_canonical_glb_and_four_mast_nodes():
    html=(ROOT/'server/delivery/robot.html').read_text(encoding='utf-8')
    asset_url=re.search(r"loadAsync\('([^']+)'\)",html).group(1)
    assert asset_url.startswith('/assets/robot/')
    data=(ROOT/asset_url.lstrip('/')).read_bytes()
    magic,version,length=struct.unpack_from('<4sII',data)
    assert magic==b'glTF' and version==2 and length==len(data)
    chunk_length,kind=struct.unpack_from('<II',data,12)
    assert kind==0x4e4f534a
    model=json.loads(data[20:20+chunk_length])
    nodes={node.get('name') for node in model['nodes']}
    assert {'Base','CameraHead',*(f'MastStage{i}' for i in range(1,5))}<=nodes
    assert len([n for n in nodes if n and n.startswith('TreadLeft')])==42
    assert len([n for n in nodes if n and n.startswith('TreadRight')])==42
    assert (ROOT/'assets/robot/CREATE3-LICENSE.txt').is_file()
    assert not (ROOT/'server/delivery/roomscan/assets').exists()
