from pathlib import Path
import pytest
from scripts.run_reference_scanner import prepare_runtime


def fixture_project(tmp_path):
    root=tmp_path/'home'
    for name in ['reference/hackerson/run.py','reference/hackerson/scanner/__init__.py','reference/hackerson/web/index.html','assets/robot/manifest.json','assets/robot/roomscan-rs01.glb','assets/robot/meshes/base.obj']:
        path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(name.encode())
    (root/"assets/robot/manifest.json").write_text('{"components":{"Base":[{"mesh":"base"}]}}')
    return root


def test_reference_launcher_copies_to_isolated_runtime_without_mutating_source(tmp_path):
    root=fixture_project(tmp_path);source=root/'reference/hackerson/run.py';before=source.read_bytes()
    runtime=prepare_runtime(root,tmp_path/'runtime')
    assert (runtime/'run.py').read_bytes()==before
    assert (runtime/'assets/robot/meshes/base.obj').exists()
    (runtime/'run.py').write_text('runtime mutation')
    assert source.read_bytes()==before


def test_reference_launcher_reports_missing_resources_before_partial_copy(tmp_path):
    root=fixture_project(tmp_path);(root/'assets/robot/manifest.json').unlink()
    with pytest.raises(ValueError,match='missing_reference_resources: assets/robot/manifest.json'):
        prepare_runtime(root,tmp_path/'runtime')
    assert not (tmp_path/'runtime').exists()

@pytest.mark.parametrize('location',['.','reference/hackerson','reference/hackerson/child'])
def test_reference_launcher_rejects_source_overwrite(tmp_path,location):
    root=fixture_project(tmp_path)
    with pytest.raises(ValueError,match='must_not_overwrite'):
        prepare_runtime(root,root/location)


def test_reference_launcher_rejects_incomplete_mesh_assets(tmp_path):
    root=fixture_project(tmp_path);(root/'assets/robot/meshes/base.obj').unlink()
    with pytest.raises(ValueError,match='robot mesh files'):
        prepare_runtime(root,tmp_path/'runtime')
