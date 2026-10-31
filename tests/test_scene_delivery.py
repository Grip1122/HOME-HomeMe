import hashlib
from pathlib import Path

import pytest

from scripts.fetch_team_scene import fetch, verify


def fixture_asset(content):
    return {"assets": [{"id": "scene_main", "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}]}


def test_team_scene_is_installed_only_after_the_manifest_checksum_matches(tmp_path):
    source = tmp_path / "source.ply"
    source.write_bytes(b"team-scene-fixture")
    destination = tmp_path / "out/scene.ply"
    manifest = fixture_asset(source.read_bytes())
    assert fetch(destination, manifest, source) == destination
    assert destination.read_bytes() == source.read_bytes()


def test_corrupt_scene_does_not_leave_a_partly_installed_asset(tmp_path):
    source = tmp_path / "corrupt.ply"
    source.write_bytes(b"wrong")
    destination = tmp_path / "out/scene.ply"
    with pytest.raises(ValueError, match="checksum_mismatch"):
        fetch(destination, fixture_asset(b"correct"), source)
    assert not destination.exists()


def test_existing_scene_is_verified_instead_of_silently_overwritten(tmp_path):
    destination = tmp_path / "scene.ply"
    destination.write_bytes(b"wrong")
    with pytest.raises(ValueError, match="checksum_mismatch"):
        fetch(destination, fixture_asset(b"correct"))
    assert destination.read_bytes() == b"wrong"
