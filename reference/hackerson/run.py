#!/usr/bin/env python3
"""Start the local scanner control room, or run an unattended evaluation."""
import os
os.environ.setdefault('MUJOCO_GL','egl')
import argparse
import json
import mimetypes
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import queue
import signal
import threading
import time
import traceback
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parent


class Runtime:
    def __init__(self,args):
        self.args=args
        self.commands=queue.Queue(maxsize=32)
        self.lock=threading.Lock()
        self.stop=threading.Event()
        self.snapshot={'status':'booting','phase':'booting'}
        self.pose={'status':'booting'}
        self.epoch_prefix=str(time.time_ns());self.epoch=0;self.pose_sequence=0
        self.last_overview_request=0.
        self.frames={};self.cloud=[];self.export_dir=None
        self.thread=threading.Thread(target=self.worker,name='mujoco-render',daemon=True)
        self.thread.start()

    def worker(self):
        engine=None
        try:
            from scanner.engine import Engine
            engine=Engine(self.args.strategy,self.args.max_scans,self.args.scene)
            last_frame=0.;last_cloud=0.;last_state=0.;speed=self.args.speed
            period=1/60
            while not self.stop.is_set():
                started=time.monotonic()
                for _ in range(8):
                    try:
                        command=self.commands.get_nowait()
                    except queue.Empty:
                        break
                    action=command['action']
                    if action=='start': engine.start()
                    elif action=='pause' and engine.status=='running': engine.status='paused';engine.log('已暂停。')
                    elif action=='reset':
                        engine.reset(command.get('strategy',engine.strategy));self.epoch+=1
                    elif action=='export': engine.export();engine.log('已保存当前点云与扫描记录。')
                    elif action=='speed': speed=command['value']
                    elif action=='scene':
                        with self.lock:self.snapshot={'status':'booting','phase':'booting','scene':command['scene']}
                        replacement=None
                        try:
                            replacement=Engine(engine.strategy,self.args.max_scans,command['scene'])
                        except Exception as exc:
                            engine.log('场景切换失败：'+str(exc))
                            with self.lock:self.snapshot=engine.state()|{'speed':speed}
                        else:
                            engine.close();engine=replacement
                            self.cloud=[];last_cloud=0.;self.epoch+=1
                engine.tick(period*speed)
                now=time.monotonic()
                # Avoid rendering an unused proxy overview while the browser displays Gaussians.
                if now-self.last_overview_request<2 and now-last_frame>1/15:
                    engine.render();last_frame=now
                self.pose_sequence+=1
                scan_pose=None if not engine.history else {**engine.history[-1],'yaw':0.}
                pose={'status':engine.status,'phase':engine.phase,'scene':engine.scene_name,'epoch':f'{self.epoch_prefix}:{self.epoch}',
                      'sequence':self.pose_sequence,'server_time':now,'xy':engine.xy.tolist(),'yaw':engine.yaw,
                      'height':engine.height,'tilt_deg':float(engine.tilt*180/3.141592653589793),'scans':len(engine.history),'scan_pose':scan_pose}
                snapshot=engine.state()|pose|{'speed':speed} if now-last_state>=.2 else None
                cloud=engine.cloud() if now-last_cloud>1.2 else None
                with self.lock:
                    self.pose=pose
                    if snapshot is not None:self.snapshot=snapshot;last_state=now
                    self.frames=dict(engine.frames)
                    self.export_dir=engine.export_dir
                    if cloud is not None:self.cloud=cloud;last_cloud=now
                self.stop.wait(max(0.,period-(time.monotonic()-started)))
        except Exception:
            error=traceback.format_exc()
            print(error,flush=True)
            with self.lock:
                self.snapshot={'status':'error','phase':'error','error':error.splitlines()[-1]}
        finally:
            if engine is not None:
                engine.close()


def handler(runtime):
    class Handler(BaseHTTPRequestHandler):
        protocol_version='HTTP/1.1'

        def log_message(self,format,*args):
            if args and str(args[0]).startswith('POST'):
                super().log_message(format,*args)

        def send(self,data,mime='application/json',status=200):
            self.send_response(status)
            self.send_header('Content-Type',mime)
            self.send_header('Content-Length',str(len(data)))
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            self.end_headers()
            try:
                self.wfile.write(data)
            except (BrokenPipeError,ConnectionResetError):
                pass

        def json(self,value,status=200):
            self.send(json.dumps(value,ensure_ascii=False).encode(),'application/json; charset=utf-8',status)

        def do_GET(self):
            path=urlparse(self.path).path
            if path=='/api/state':
                with runtime.lock: state=runtime.snapshot
                return self.json(state)
            if path=='/api/pose':
                with runtime.lock: pose=runtime.pose
                return self.json(pose)
            if path=='/api/cloud':
                with runtime.lock: cloud=runtime.cloud
                return self.json({'points':cloud})
            if path in ('/frame.jpg','/ring.jpg'):
                if path=='/frame.jpg':runtime.last_overview_request=time.monotonic()
                with runtime.lock: data=runtime.frames.get('overview' if path=='/frame.jpg' else 'ring')
                return self.send(data,'image/jpeg') if data else self.json({'waiting':True},503)
            if path.startswith('/download/'):
                name=path.removeprefix('/download/')
                if name not in ('cloud.ply','run.json','occupancy.npz','overview.jpg','ring.jpg'):
                    return self.json({'error':'Not found'},404)
                with runtime.lock: directory=runtime.export_dir
                file=directory/name if directory else None
                if file is None or not file.is_file():
                    return self.json({'error':'Export is not ready'},404)
                return self.send(file.read_bytes(),mimetypes.guess_type(name)[0] or 'application/octet-stream')
            restaurant_assets={'/assets/restaurant/'+name:ROOT/'assets'/'restaurant'/name for name in ('restaurant.compressed.ply','restaurant_cutaway.compressed.ply','manifest.json','license.txt')}
            if path in restaurant_assets:
                file=restaurant_assets[path]
                if not file.is_file():return self.json({'error':'Asset unavailable'},404)
                return self.send(file.read_bytes(),mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
            robot_assets={'/assets/robot/'+name:ROOT/'assets'/'robot'/name for name in ('roomscan-rs01.glb','manifest.json','CREATE3-LICENSE.txt')}
            if path in robot_assets:
                file=robot_assets[path]
                return self.send(file.read_bytes(),mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
            files={'/robot':'robot.html','/robot-preview.mjs':'robot-preview.mjs','/robot.mjs':'robot.mjs','/':'index.html','/app.js':'app.js','/style.css':'style.css','/restaurant.js':'restaurant.js','/motion.mjs':'motion.mjs','/raw-camera.mjs':'raw-camera.mjs','/vendor/playcanvas.mjs':'vendor/playcanvas.mjs','/vendor/playcanvas.LICENSE':'vendor/playcanvas.LICENSE'}
            if path in files:
                file=ROOT/'web'/files[path]
                mime=mimetypes.guess_type(str(file))[0] or 'text/plain'
                return self.send(file.read_bytes(),mime+'; charset=utf-8')
            return self.json({'error':'Not found'},404)

        def do_POST(self):
            if self.path!='/api/command':
                return self.json({'error':'Not found'},404)
            # Browser writes must originate from this local control room, including over SSH forwarding.
            origin=self.headers.get('Origin')
            if origin and origin not in ('http://'+self.headers.get('Host',''),'https://'+self.headers.get('Host','')):
                return self.json({'error':'Origin rejected'},403)
            try:
                length=int(self.headers.get('Content-Length','0'))
                if not 0<length<=2048: raise ValueError('Invalid request length')
                command=json.loads(self.rfile.read(length))
                if not isinstance(command,dict): raise ValueError('Expected object')
                if command.get('action') not in ('start','pause','reset','export','speed','scene'): raise ValueError('Unknown action')
                if command['action']=='scene' and command.get('scene') not in ('demo','restaurant'):raise ValueError('Unknown scene')
                if 'strategy' in command and command['strategy'] not in ('adaptive','fixed'): raise ValueError('Unknown strategy')
                if command['action']=='speed' and (type(command.get('value')) not in (int,float) or not .5<=command['value']<=8): raise ValueError('Speed must be 0.5–8')
                runtime.commands.put_nowait(command)
            except (ValueError,TypeError,json.JSONDecodeError,queue.Full) as exc:
                return self.json({'error':str(exc)},400)
            self.json({'accepted':True},202)
    return Handler


def benchmark(args):
    from scanner.engine import Engine
    engine=Engine(args.strategy,args.max_scans,args.scene)
    started=time.monotonic()
    try:
        engine.start()
        steps=0
        while engine.status=='running':
            engine.tick(.4);steps+=1
            if engine.phase=='planning':
                row=engine.history[-1]
                print(json.dumps(row,ensure_ascii=False),flush=True)
            if steps>25000:
                raise RuntimeError('Execution step limit exceeded')
        engine.render();engine.export()
        result={'strategy':engine.strategy,'scans':len(engine.history),'coverage':engine.evaluator.coverage,
                'cloud_points':len(engine.map.cloud),'known_voxels':engine.map.known,'distance_m':engine.distance,
                'stop_reason':engine.reason,'wall_seconds':time.monotonic()-started,'export':str(engine.export_dir)}
        (engine.export_dir/'benchmark.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2),flush=True)
    finally:
        engine.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--strategy',choices=['adaptive','fixed'],default='adaptive')
    parser.add_argument('--scene',choices=['demo','restaurant'],default='restaurant')
    parser.add_argument('--max-scans',type=int,default=48)
    parser.add_argument('--speed',type=float,default=3.)
    parser.add_argument('--benchmark',action='store_true')
    args=parser.parse_args()
    if not 1<=args.max_scans<=300 or not .5<=args.speed<=8:
        parser.error('max-scans must be 1–300; speed must be 0.5–8')
    if args.benchmark:
        benchmark(args);return
    runtime=Runtime(args)
    server=ThreadingHTTPServer((args.host,args.port),handler(runtime))
    server.daemon_threads=True
    print(f'Scanner control room: http://{args.host}:{args.port}',flush=True)
    def stop(signum,frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM,stop)
    try:
        server.serve_forever(poll_interval=.25)
    except KeyboardInterrupt:
        pass
    finally:
        runtime.stop.set();server.server_close();runtime.thread.join(timeout=15)


if __name__=='__main__':
    main()
