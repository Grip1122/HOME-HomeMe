"""Verify headless RGB/depth rendering; this is not an autonomous scanner."""
import os
os.environ.setdefault("MUJOCO_GL", "egl")

import json
from pathlib import Path
import time
import mujoco
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "render_check"

XML = """
<mujoco model="scanner_render_check">
  <visual><global offwidth="960" offheight="640"/></visual>
  <worldbody>
    <light pos="0 0 5" dir="0 0 -1"/>
    <geom type="plane" size="4 3 .1" rgba=".55 .57 .6 1"/>
    <geom type="box" pos="0 3 1.4" size="4 .08 1.4" rgba=".8 .83 .88 1"/>
    <geom type="box" pos="-4 0 1.4" size=".08 3 1.4" rgba=".8 .83 .88 1"/>
    <geom type="box" pos="4 0 1.4" size=".08 3 1.4" rgba=".8 .83 .88 1"/>
    <geom type="box" pos="1 1 .65" size=".8 .55 .08" rgba=".5 .3 .15 1"/>
    <geom type="box" pos="-1.8 1 .4" size=".9 .4 .4" rgba=".2 .45 .55 1"/>
    <body name="base" pos="0 0 .12">
      <geom type="cylinder" size=".24 .10" rgba=".12 .15 .19 1"/>
      <geom type="cylinder" pos="0 0 .42" size=".035 .35" rgba=".45 .48 .52 1"/>
      <body name="middle_stage" pos="0 0 .8">
        <joint name="lift_lower" type="slide" axis="0 0 1" range="0 .45"/>
        <geom type="cylinder" pos="0 0 -.45" size=".028 .45" rgba=".60 .63 .68 1"/>
      <body name="mast">
        <joint name="lift_upper" type="slide" axis="0 0 1" range="0 .45"/>
        <geom type="cylinder" pos="0 0 -.45" size=".020 .45" rgba=".72 .75 .8 1"/>
        <body name="camera_head">
          <joint name="pitch" type="hinge" axis="1 0 0" range="-.7 .7"/>
          <geom type="sphere" size=".09" rgba=".1 .65 .85 1"/>
          <camera name="sensor" pos="0 .11 0" xyaxes="1 0 0 0 0 1" fovy="75"/>
        </body>
      </body>
      </body>
    </body>
  </worldbody>
</mujoco>
"""

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    model = mujoco.MjModel.from_xml_string(XML)
    data = mujoco.MjData(model)
    camera = mujoco.MjvCamera()
    camera.lookat[:] = [0, .5, .7]
    camera.distance = 8.5
    camera.azimuth = 110
    camera.elevation = -30
    start = time.perf_counter()
    report = {"mujoco": mujoco.__version__, "backend": os.environ["MUJOCO_GL"],
              "scope": "RGB/depth and joint pose check only; no navigation or autonomous scanning", "poses": []}
    with mujoco.Renderer(model, height=640, width=960) as renderer:
        for name, height, pitch in [("low", 0., 0.), ("high", .8, -.25)]:
            data.qpos[:] = [height / 2, height / 2, pitch]
            mujoco.mj_forward(model, data)
            renderer.update_scene(data, camera=camera)
            Image.fromarray(renderer.render()).save(OUT / f"overview_{name}.png")
            renderer.update_scene(data, camera="sensor")
            Image.fromarray(renderer.render()).save(OUT / f"sensor_{name}.png")
            renderer.enable_depth_rendering()
            depth = renderer.render().copy()
            renderer.disable_depth_rendering()
            if not np.isfinite(depth).all() or float(depth.min()) <= 0:
                raise RuntimeError("Invalid depth image")
            np.save(OUT / f"depth_{name}.npy", depth)
            report["poses"].append({"name": name, "lift_m": height, "pitch_rad": pitch,
                                     "depth_min_m": float(depth.min()), "depth_max_m": float(depth.max())})
    report["elapsed_s"] = time.perf_counter() - start
    (OUT / "result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
