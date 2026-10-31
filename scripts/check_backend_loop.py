"""Run A's unmodified executor against live HTTP/SQLite with a pinned B layout.

Review-only: imports JS from an explicit Git ref into a temporary directory;
does not merge that ref, distribute scene binaries, or modify web/.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tarfile
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--executor-ref', required=True)
    parser.add_argument('--layout-ref', required=True, help='ref:path/to/layout.json')
    args = parser.parse_args()
    import uvicorn
    from server.main import create_app

    node = shutil.which('node')
    dependencies = ROOT / 'web/node_modules'
    if not node or not (dependencies / 'three/package.json').is_file():
        parser.error('Install the existing web dependencies with npm ci; Node is required.')
    executor_sha = git('rev-parse', args.executor_ref).decode().strip()
    layout_ref, layout_path = args.layout_ref.split(':', 1)
    layout_sha = git('rev-parse', layout_ref).decode().strip()
    layout_bytes = git('show', f'{layout_sha}:{layout_path}')
    layout = json.loads(layout_bytes)
    other = {**layout, 'layout_id': layout['layout_id'] + '_isolated'}

    with tempfile.TemporaryDirectory(prefix='home-backend-loop-') as directory:
        temp = Path(directory)
        # Only source modules; no assets, configs, dist, credentials or reference/.
        archive = git('archive', executor_sha, 'web/src', 'web/package.json')
        with tarfile.open(fileobj=io.BytesIO(archive)) as source:
            for member in source.getmembers():
                relative = Path(member.name)
                if relative.is_absolute() or '..' in relative.parts:
                    raise ValueError('unsafe Git archive path')
                if member.isfile():
                    path = temp / relative
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(source.extractfile(member).read())
        (temp / 'web/node_modules').symlink_to(dependencies, target_is_directory=True)
        fixture = temp / 'layout.json'
        fixture.write_bytes(layout_bytes)
        database = temp / 'loop.db'
        app = create_app(database, {layout['layout_id']: layout, other['layout_id']: other})
        started = threading.Event()

        class ReadyServer(uvicorn.Server):
            async def startup(self, sockets=None):
                await super().startup(sockets=sockets)
                started.set()

        listener = socket.socket()
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
        server = ReadyServer(uvicorn.Config(app, log_level='error', lifespan='off'))
        thread = threading.Thread(target=server.run, kwargs={'sockets': [listener]}, daemon=True)
        thread.start()
        try:
            if not started.wait(10):
                raise TimeoutError('HTTP server did not become ready')
            result = subprocess.run([node, str(ROOT / 'tests/node/real-executor.mjs'),
                                     f'http://127.0.0.1:{port}', str(temp), str(fixture)],
                                    cwd=ROOT, capture_output=True, text=True, timeout=120)
            print(result.stdout)
            if result.returncode:
                print(result.stderr, file=sys.stderr)
                return result.returncode
        finally:
            server.should_exit = True
            thread.join(timeout=10)
            listener.close()
        # New app/Store, same database: no in-memory persistence shortcuts.
        again = create_app(database, {layout['layout_id']: layout})
        rows = again.state.store.logs(layout['layout_id'], 100)
        assert len(rows) >= 5 and any(row['ok'] is False for row in rows)
        assert any(row['source'] == 'corrective' and row['ok'] for row in rows)
        print(json.dumps({'status': 'passed', 'mode': 'isolated-review',
                          'executor_commit': executor_sha, 'layout_commit': layout_sha,
                          'layout_id': layout['layout_id'],
                          'layout_sha256': hashlib.sha256(layout_bytes).hexdigest(),
                          'persisted_logs_after_restart': len(rows)}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
