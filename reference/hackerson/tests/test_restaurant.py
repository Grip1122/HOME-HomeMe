from pathlib import Path
import numpy as np
import pytest
from scanner.restaurant import Restaurant,ASSET
from scanner.mapping import OnlineMap


@pytest.mark.skipif(not (ASSET/'runtime.npz').exists(),reason='Restaurant asset is optional')
def test_restaurant_candidates_stay_in_supported_connected_collision_free_floor():
    scene=Restaurant();nav=scene.navigation();field=nav.distances(scene.start)
    assert scene.safe(*scene.start)
    assert len(nav.candidates)>=5
    for point in nav.candidates:
        route=nav.path(scene.start,point,field)
        assert route is not None
        assert all(nav.segment_safe(a,b) for a,b in zip(route,route[1:]))
    assert not scene.safe(-100,100)
    assert scene.meta['scale_calibrated'] is False


def test_online_map_uses_scene_bounds_not_original_demo_room():
    mapping=OnlineMap([[-12.,-7.,0.],[11.,11.,3.5]])
    point=np.array([[7.,7.,1.]])
    mapping.integrate(np.array([6.,7.,1.]),point,np.array([[90,80,70]]))
    assert len(mapping.cloud)==1
    assert mapping.grid.shape==(115,90,18)
    assert mapping.grid[tuple(mapping.indices(point)[0])]==2
