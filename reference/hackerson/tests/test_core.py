import math
import numpy as np
from scanner.world import Navigation, START, safe_xy, rotation, camera_axes
from scanner.mapping import OnlineMap, SurfaceEvaluator, pixel_vectors
from scipy.spatial import cKDTree
from scanner.planner import Planner


def test_all_viewpoints_have_collision_free_continuous_routes():
    nav=Navigation()
    assert len(nav.candidates)>=15
    field=nav.distances(START)
    for goal in nav.candidates:
        path=nav.path(START,goal,field)
        assert path is not None
        assert np.allclose(path[0],START) and np.allclose(path[-1],goal)
        assert all(nav.segment_safe(a,b) for a,b in zip(path,path[1:]))
    assert not nav.segment_safe([-2.6,.8],[-2.6,2.6])  # sofa blocks this shortcut
    assert not safe_xy(3.45,1.8)  # tall cabinet
    assert not safe_xy(3.9,0)  # wall clearance


def test_depth_camera_backprojection_uses_negative_z_and_correct_handedness():
    vectors,v,u=pixel_vectors(4)
    for i in range(4):
        forward,axes=camera_axes(i)
        assert np.allclose(axes@np.array([0.,0.,-1.]),forward)
        assert np.isclose(np.linalg.det(axes),1)
        assert np.allclose(axes.T@axes,np.eye(3))
    assert (vectors[:,2]==-1).all()
    assert np.allclose(rotation(.4,-.65).T@rotation(.4,-.65),np.eye(3))


def test_ray_integration_marks_free_then_surface_and_does_not_clear_hits():
    mapping=OnlineMap()
    origin=np.array([0.,0.,1.])
    point=np.array([[2.,0.,1.]])
    mapping.integrate(origin,point,np.array([[10,20,30]]))
    index=lambda p:tuple(mapping.indices(np.array(p)))
    assert mapping.grid[index([1.,0.,1.])]==1
    assert mapping.grid[index([2.,0.,1.])]==2
    assert mapping.grid[index([2.6,0.,1.])]==0
    known=mapping.known
    mapping.integrate(origin,np.array([[3.,0.,1.]]),np.array([[10,20,30]]))
    assert mapping.grid[index([2.,0.,1.])]==2
    assert mapping.known>=known


def test_expected_gain_depends_only_on_observed_map_and_stops_at_occupied_shell():
    mapping=OnlineMap()
    unknown=mapping.expected_gain([-3.,-2.],1.15,0.)
    assert unknown>0
    mapping.grid[:]=1
    assert mapping.expected_gain([-3.,-2.],1.15,0.)==0
    mapping.grid[:]=2
    mapping.view_masks[:]=63
    assert mapping.expected_gain([-3.,-2.],1.15,0.)==0
    # No evaluator or full scene object is accepted by the online planner.
    planner=Planner(Navigation(),mapping)
    assert not hasattr(planner,'evaluator')


def test_surface_metric_does_not_count_opposite_face_of_thin_table():
    evaluator=SurfaceEvaluator.__new__(SurfaceEvaluator)
    evaluator.points=np.array([[0.,0.,1.],[0.,0.,.88]])
    evaluator.normals=np.array([[0.,0.,1.],[0.,0.,-1.]])
    evaluator.tree=cKDTree(evaluator.points)
    evaluator.seen=np.zeros(2,dtype=bool)
    evaluator.observe(np.array([[0.,0.,1.]]),np.array([0.,0.,2.]))
    assert evaluator.seen.tolist()==[True,False]


def test_planner_fixed_height_baseline_and_visited_exclusion():
    nav=Navigation();mapping=OnlineMap()
    planner=Planner(nav,mapping,'fixed')
    first=planner.choose(START,.75,0.)
    assert first.height==1.15 and first.tilt==0.
    planner.visited.add(first.key)
    second=planner.choose(START,.75,0.)
    assert second.key!=first.key
