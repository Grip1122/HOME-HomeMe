import hashlib
import tarfile

import pytest

from scripts.pack_roomscan import excluded, pack


def test_archive_preserves_source_hidden_files_and_installed_dependencies(tmp_path):
    source = tmp_path / "source"
    for name in ("run.py", ".gitignore", "tools/python/library.py", "assets/robot/model.glb"):
        file = source / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(name.encode())
    output = tmp_path / "snapshot.tar.gz"
    manifest = pack(source, output)
    assert manifest["archived_files"] == 4
    assert manifest["sha256"] == hashlib.sha256(output.read_bytes()).hexdigest()
    with tarfile.open(output) as archive:
        assert "Hackerson/.gitignore" in archive.getnames()
        assert archive.extractfile("Hackerson/tools/python/library.py").read() == b"tools/python/library.py"


def test_user_excluded_restaurant_is_not_in_archive_even_when_git_would_ignore_other_files(tmp_path):
    source = tmp_path / "source"
    (source / "assets/restaurant").mkdir(parents=True)
    (source / "assets/restaurant/scene.ply").write_bytes(b"old scene")
    (source / "天安骏业集团餐厅.zip").write_bytes(b"old zip")
    (source / "run.py").write_bytes(b"program")
    output = tmp_path / "snapshot.tar.gz"
    manifest = pack(source, output)
    assert manifest["archived_files"] == 1 and manifest["excluded_files"] == 2
    with tarfile.open(output) as archive:
        assert archive.getnames() == ["Hackerson/run.py"]


def test_archive_rejects_output_inside_source_instead_of_archiving_itself(tmp_path):
    with pytest.raises(ValueError, match="outside_source"):
        pack(tmp_path, tmp_path / "recursive.tar.gz")
