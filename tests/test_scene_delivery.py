import hashlib
from pathlib import Path

import pytest

from scripts.fetch_team_scene import fetch, verify


def fixture_asset(content):
    return {"assets": [{"id": "scene_main", "license_status": "verified", "license_name": "MIT (test fixture)", "license_source_url": "https://example.invalid/fixture-license", "distribution_allowed": True, "download_url": "https://github.com/Grip1122/HOME-HomeMe/releases/download/splat-v1/scene.ply", "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}]}


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


def test_unverified_license_blocks_installation_before_network_or_local_copy(tmp_path,monkeypatch):
    manifest=fixture_asset(b'data');manifest['assets'][0]['license_status']='unverified'
    monkeypatch.setattr('scripts.fetch_team_scene.urlopen',lambda *a,**k:pytest.fail('network must not be used'))
    with pytest.raises(ValueError,match='license_unverified'):
        fetch(tmp_path/'scene.ply',manifest)
    assert not (tmp_path/'scene.ply').exists()


def test_untrusted_source_is_rejected_before_download(tmp_path):
    manifest=fixture_asset(b'data');manifest['assets'][0]['download_url']='https://example.invalid/arbitrary.ply'
    with pytest.raises(ValueError,match='untrusted_source'):
        fetch(tmp_path/'scene.ply',manifest)


def test_interrupted_download_removes_temporary_and_destination_files(tmp_path,monkeypatch):
    import io
    class Interrupted(io.BytesIO):
        def read(self,*args):
            if self.tell():
                raise OSError('injected connection loss')
            return super().read(2)
    monkeypatch.setattr('scripts.fetch_team_scene.urlopen',lambda *a,**k:Interrupted(b'data'))
    destination=tmp_path/'out/scene.ply'
    with pytest.raises(OSError,match='connection loss'):
        fetch(destination,fixture_asset(b'data'))
    assert not destination.exists()
    assert list(destination.parent.iterdir())==[]


def test_same_size_wrong_digest_and_wrong_size_are_both_rejected(tmp_path):
    source=tmp_path/'source';source.write_bytes(b'wrong')
    for expected in [b'right',b'longer-right']:
        destination=tmp_path/'out/scene.ply'
        with pytest.raises(ValueError,match='checksum_mismatch'):
            fetch(destination,fixture_asset(expected),source)
        assert not destination.exists()
        assert list(destination.parent.iterdir())==[]
