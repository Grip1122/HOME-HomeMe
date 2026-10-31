"""Integration checks against actual EGL-rendered depth, not synthetic metrics."""
import numpy as np
from scanner.engine import Engine


def test_real_sensor_sees_cutaway_walls_and_ceiling_and_exports(tmp_path):
    engine=Engine(max_scans=3)
    try:
        engine.start()
        for _ in range(3000):
            engine.tick(.4)
            if engine.status=='completed':break
        assert engine.status=='completed' and engine.reason=='scan_budget'
        assert len(engine.history)==3
        assert engine.history[-1]['coverage']>engine.history[0]['coverage']>0
        assert engine.evaluator.breakdown()['south_wall']>30
        assert engine.evaluator.breakdown()['ceiling']>30
        assert len(engine.map.cloud)>3000
        assert all(b['known_voxels']>=a['known_voxels'] for a,b in zip(engine.history,engine.history[1:]))
        assert engine.sensor_options.geomgroup[3]==1
        assert engine.overview_options.geomgroup[3]==0
        assert np.allclose(engine.data.cam_xpos[0,2],engine.height,atol=.11)
        engine.export_dir=tmp_path
        engine.export()
        ply=(tmp_path/'cloud.ply').read_text()
        assert ply.startswith('ply\n')
        assert f'element vertex {len(engine.map.cloud)}\n' in ply
        assert (tmp_path/'evaluation.npz').exists()
    finally:
        engine.close()
