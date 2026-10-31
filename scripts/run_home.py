"""Start the HOME / 小觅 HTTP API and optional production frontend."""
import argparse
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--database", type=Path)
    args = parser.parse_args()
    if args.database:
        os.environ["HOMETWIN_DB"] = str(args.database)
    import uvicorn
    uvicorn.run("server.main:create_app", factory=True, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
