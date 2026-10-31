"""The new exterior must preserve sensor poses and navigation clearance."""
import math
import mujoco
import numpy as np
from scanner.world import scene_xml, rotation, camera_axes


def test_crawler_visual_clearance_and_camera_articulation():
    model=mujoco.MjModel.from_xml_string(scene_xml())
    data=mujoco.MjData(model)
    assert model.nq==8
    assert model.ncam==4
    for height in (.55,1.15,2.3):
        for tilt in (-.65,0,.65):
            yaw=.7
            data.qpos[:]=[0,0,yaw,*([(height-.55)/4]*4),tilt]
            mujoco.mj_forward(model,data)
            for i in range(4):
                cam=model.camera('ring_'+str(i)).id
                forward,_=camera_axes(i)
                expected=np.array([0,0,height])+rotation(yaw,tilt)@(.105*forward)
                assert np.allclose(data.cam_xpos[cam],expected)
            for geom in np.flatnonzero(model.geom_group==5):
                mesh=model.geom_dataid[geom]
                start=model.mesh_vertadr[mesh];count=model.mesh_vertnum[mesh]
                verts=model.mesh_vert[start:start+count]
                world=verts@data.geom_xmat[geom].reshape(3,3).T+data.geom_xpos[geom]
                assert np.linalg.norm(world[:,:2],axis=1).max()<.25
                assert world[:,2].min()>=-1e-5
