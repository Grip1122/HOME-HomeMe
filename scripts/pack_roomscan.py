"""Archive every prototype file, with the user's old-restaurant exclusion and hash inventory."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import tarfile


def restaurant_runs(source):
    runs = set()
    for file in (source / "artifacts/runs").glob("*/run.json"):
        if json.loads(file.read_text(encoding="utf-8")).get("scene") == "restaurant":
            runs.add(file.parent.relative_to(source).as_posix() + "/")
    return runs


def excluded(path, runs):
    return (path == "天安骏业集团餐厅.zip" or path.startswith((
        "assets/restaurant/", "artifacts/restaurant", "artifacts/camera_motion_qa/"))
        or path in ("artifacts/robot_qa/restaurant-closeup.png", "artifacts/robot_qa/proxy-exterior.png")
        or any(path.startswith(prefix) for prefix in runs))


def pack(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    if output.is_relative_to(source):
        raise ValueError("archive_output_must_be_outside_source")
    output.parent.mkdir(parents=True, exist_ok=True)
    runs = restaurant_runs(source)
    paths = sorted(p for p in source.rglob("*") if p.is_file() or p.is_symlink())

    def inspect(path):
        relative = path.relative_to(source).as_posix()
        if excluded(relative, runs):
            return {"path": relative, "disposition": "excluded_old_restaurant", "bytes": path.stat().st_size}
        if path.is_symlink():
            return {"path": relative, "disposition": "archived", "type": "symlink", "target": str(path.readlink())}
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        return {"path": relative, "disposition": "archived", "type": "file",
                "bytes": path.stat().st_size, "sha256": digest.hexdigest()}

    with ThreadPoolExecutor(max_workers=12) as pool:
        inventory = list(pool.map(inspect, paths))
    with tarfile.open(output, "w:gz", compresslevel=6) as archive:
        for entry in inventory:
            if entry["disposition"] == "archived":
                archive.add(source / entry["path"], arcname="Hackerson/" + entry["path"], recursive=False)
    digest = hashlib.sha256()
    with output.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    manifest = {"version": 1, "archive": output.name, "sha256": digest.hexdigest(), "bytes": output.stat().st_size,
                "archived_files": sum(e["disposition"] == "archived" for e in inventory),
                "excluded_files": sum(e["disposition"] != "archived" for e in inventory),
                "exclusion_authorization": "User explicitly excluded ZIP and all original restaurant scene data.",
                "entries": inventory}
    output.with_suffix(output.suffix + ".manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = pack(args.source, args.output)
    print(json.dumps({k: v for k, v in result.items() if k != "entries"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
