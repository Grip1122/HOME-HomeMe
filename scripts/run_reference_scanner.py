"""HOME / 小觅 optional experiment; never imported by the production server."""
from __future__ import annotations
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]


def prepare_runtime(root, destination):
    root=Path(root).resolve();destination=Path(destination).resolve()
    reference=root/'reference/hackerson'
    if destination==root or destination in root.parents or destination==reference or destination.is_relative_to(reference):
        raise ValueError('runtime_must_not_overwrite_project_or_readonly_reference')
    required=[reference/'run.py',reference/'scanner',reference/'web',root/'assets/robot/manifest.json',root/'assets/robot/roomscan-rs01.glb',root/'assets/robot/meshes']
    missing=[str(p.relative_to(root)) for p in required if not p.exists()]
    if missing:
        raise ValueError('missing_reference_resources: '+', '.join(missing))
    try:
        manifest=json.loads((root/'assets/robot/manifest.json').read_text(encoding='utf-8'))
        meshes=[root/'assets/robot/meshes'/(entry['mesh']+'.obj')
                for group in manifest['components'].values() for entry in group]
    except (ValueError,KeyError,TypeError) as exc:
        raise ValueError('invalid_robot_manifest') from exc
    if not meshes or any(not p.is_file() for p in meshes):
        raise ValueError('missing_reference_resources: robot mesh files listed in manifest')
    destination.mkdir(parents=True,exist_ok=True)
    shutil.copy2(reference/'run.py',destination/'run.py')
    for name in ['scanner','web']:
        shutil.copytree(reference/name,destination/name,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__'))
    shutil.copytree(root/'assets/robot',destination/'assets/robot',dirs_exist_ok=True)
    return destination


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime',type=Path,default=ROOT/'.local/reference-runtime')
    parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--gpu',type=int,default=1,help='Linux EGL physical GPU index; not a browser GPU selector')
    parser.add_argument('--check-only',action='store_true')
    args=parser.parse_args(argv)
    if not 1<=args.port<=65535 or args.gpu<0:
        parser.error('port must be 1..65535 and gpu must be nonnegative')
    if sys.version_info<(3,11):
        parser.error('Python 3.11+ required')
    missing=[name for name in ['mujoco','numpy','scipy','PIL'] if importlib.util.find_spec(name) is None]
    if missing:
        parser.error('missing_optional_dependencies: '+', '.join(missing)+'; install -r reference/hackerson/requirements.txt in an isolated environment')
    try:
        runtime=prepare_runtime(ROOT,args.runtime)
    except ValueError as exc:
        parser.error(str(exc))
    if args.check_only:
        print('HOME / 小觅 reference resources ready: '+str(runtime));return 0
    env=os.environ.copy()
    env['MUJOCO_GL']='glfw' if os.name=='nt' else 'egl'
    if os.name!='nt':
        env['MUJOCO_EGL_DEVICE_ID']=str(args.gpu)
        env['CUDA_VISIBLE_DEVICES']=str(args.gpu)
    print('Experimental demo only; no team-scene calibration or production navigation. Ctrl+C stops the process.',flush=True)
    return subprocess.call([sys.executable,str(runtime/'run.py'),'--scene','demo','--host','127.0.0.1','--port',str(args.port)],cwd=runtime,env=env)


if __name__=='__main__':
    raise SystemExit(main())
