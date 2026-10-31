"""Manage this project's local simulation server without changing system services."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
from urllib.request import urlopen

ROOT=Path(__file__).resolve().parents[1]
PID=ROOT/'artifacts'/'server.pid'
LOG=ROOT/'artifacts'/'server.log'


def owned_pid():
    if not PID.exists(): return None
    try:
        pid=int(PID.read_text())
        cmd=Path(f'/proc/{pid}/cmdline').read_bytes().split(b'\0')
        if str(ROOT/'run.py').encode() in cmd: return pid
    except (ValueError,OSError): pass
    return None


def main():
    action=sys.argv[1] if len(sys.argv)>1 else 'status'
    pid=owned_pid()
    if action=='stop':
        if pid:
            os.kill(pid,signal.SIGTERM)
            print(f'Stop signal sent to scanner PID {pid}')
            for _ in range(150):
                if owned_pid() is None: break
                time.sleep(.1)
        else: print('Scanner is not running')
        return
    if action=='start':
        if pid:
            print(f'Scanner already running, PID {pid}');return
        LOG.parent.mkdir(exist_ok=True)
        with LOG.open('ab') as log:
            process=subprocess.Popen([sys.executable,'-u',str(ROOT/'run.py')],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        PID.write_text(str(process.pid)+'\n')
        for _ in range(40):
            if process.poll() is not None:
                raise SystemExit('Server exited. See '+str(LOG))
            try:
                with urlopen('http://127.0.0.1:8765/api/state',timeout=1) as response:
                    state=json.load(response)
                print(f'Scanner running, PID {process.pid}, state={state["status"]}')
                print('Local URL: http://127.0.0.1:8765')
                print('Log: '+str(LOG))
                return
            except OSError:
                time.sleep(.2)
        print('Server is starting. Check status or log.')
    elif action=='status':
        print(f'PID: {pid or "not running"}')
        if pid:
            with urlopen('http://127.0.0.1:8765/api/state',timeout=3) as response:
                state=json.load(response)
            print(json.dumps({k:state[k] for k in ('status','phase','scans','coverage') if k in state},ensure_ascii=False,indent=2))
    else:
        raise SystemExit('Usage: python3 scripts/service.py start|status|stop')


if __name__=='__main__': main()
