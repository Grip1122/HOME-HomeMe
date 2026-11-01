"""One-click local launcher for Xiaomi HOME.

Builds the web app when necessary, starts the local API/static server, then opens the
user-facing homepage. All generated files remain inside this repository.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import threading
import time
import webbrowser

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
VENV = ROOT / ".venv"


def command(name: str) -> str:
    found = shutil.which(name)
    if not found:
        raise RuntimeError(f"Missing required command: {name}")
    return found


def run(args: list[str], cwd: Path) -> None:
    result = subprocess.run(args, cwd=cwd, check=False)
    if result.returncode:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(args)}")


def port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex((host, port)) == 0


def ensure_environment(skip_install: bool) -> Path:
    python = VENV / "Scripts" / "python.exe"
    if not python.exists():
        print("Creating local Python environment...")
        run([sys.executable, "-m", "venv", str(VENV)], ROOT)
    if not skip_install:
        print("Installing or checking Python dependencies...")
        run([str(python), "-m", "pip", "install", "-r", str(ROOT / "server" / "requirements.txt")], ROOT)
    npm = command("npm.cmd" if os.name == "nt" else "npm")
    if not (WEB / "node_modules").is_dir():
        print("Installing web dependencies...")
        run([npm, "ci"], WEB)
    print("Building Xiaomi HOME web application...")
    run([npm, "run", "build"], WEB)
    return python


def open_when_ready(url: str, port: int) -> None:
    for _ in range(80):
        if port_open("127.0.0.1", port):
            webbrowser.open(url)
            return
        time.sleep(0.1)


def main() -> int:
    parser = argparse.ArgumentParser(description="Start the Xiaomi HOME local application.")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--skip-install", action="store_true", help="Do not reinstall Python dependencies.")
    parser.add_argument("--no-browser", action="store_true", help="Do not open the browser automatically.")
    args = parser.parse_args()

    if port_open("127.0.0.1", args.port):
        print(f"Xiaomi HOME is already using http://127.0.0.1:{args.port}")
        if not args.no_browser:
            webbrowser.open(f"http://127.0.0.1:{args.port}")
        return 0

    try:
        python = ensure_environment(args.skip_install)
    except RuntimeError as error:
        print(f"Startup preparation failed: {error}", file=sys.stderr)
        return 1

    if not args.no_browser:
        threading.Thread(
            target=open_when_ready,
            args=(f"http://127.0.0.1:{args.port}", args.port),
            daemon=True,
        ).start()

    print(f"Xiaomi HOME is starting at http://127.0.0.1:{args.port}")
    os.execv(str(python), [str(python), str(ROOT / "scripts" / "run_home.py"), "--host", "127.0.0.1", "--port", str(args.port)])


if __name__ == "__main__":
    raise SystemExit(main())
