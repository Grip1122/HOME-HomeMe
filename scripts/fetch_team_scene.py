"""Download the team's existing Release asset and verify its frozen manifest hash."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "Grip1122/HOME-HomeMe"


def verify(path, asset):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    if Path(path).stat().st_size != asset["bytes"] or digest.hexdigest() != asset["sha256"]:
        raise ValueError("team_scene_checksum_mismatch")
    return digest.hexdigest()


def fetch(destination, manifest, source=None):
    asset = next(a for a in manifest["assets"] if a["id"] == "scene_main")
    if (asset.get("license_status") != "verified" or not asset.get("license_name")
            or not str(asset.get("license_source_url", "")).startswith("https://")
            or asset.get("distribution_allowed") is not True):
        raise ValueError("team_scene_license_unverified: provide the original license and source before installation")
    expected_url = f"https://github.com/{REPOSITORY}/releases/download/splat-v1/scene.ply"
    if asset.get("download_url") != expected_url:
        raise ValueError("team_scene_untrusted_source")
    destination = Path(destination)
    if destination.exists():
        verify(destination, asset)
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    url = expected_url
    with tempfile.TemporaryDirectory(dir=destination.parent) as temporary:
        download = Path(temporary) / "scene.ply"
        if source is not None:
            shutil.copyfile(source, download)
        else:
            with urlopen(url, timeout=120) as response, download.open("wb") as stream:
                shutil.copyfileobj(response, stream)
        verify(download, asset)
        download.replace(destination)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "assets/gaussian-splat/scene.ply")
    parser.add_argument("--source", type=Path, help="Optional local copy; still verified before installation")
    args = parser.parse_args()
    manifest = json.loads((ROOT / "assets/gaussian-splat/manifest.json").read_text(encoding="utf-8"))
    print(fetch(args.output, manifest, args.source))


if __name__ == "__main__":
    main()
