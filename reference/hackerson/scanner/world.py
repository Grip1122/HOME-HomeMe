"""Shared scene geometry. Navigation uses its 2D projection; NBV does not."""
from dataclasses import dataclass
import heapq
import math
import numpy as np


@dataclass(frozen=True)
class Box:
    name: str
    center: tuple
    half: tuple
    color: str
    group: int = 0


BOXES = [
    Box('floor', (0, 0, -.08), (4.08, 3.08, .08), '.32 .38 .41 1'),
    Box('north_wall', (0, 3.08, 1.4), (4.08, .08, 1.4), '.79 .83 .82 1'),
    Box('south_wall', (0, -3.08, 1.4), (4.08, .08, 1.4), '.79 .83 .82 1', 3),
    Box('west_wall', (-4.08, 0, 1.4), (.08, 3, 1.4), '.72 .79 .8 1'),
    Box('east_wall', (4.08, 0, 1.4), (.08, 3, 1.4), '.72 .79 .8 1'),
    Box('ceiling', (0, 0, 2.88), (4.08, 3.08, .08), '.88 .89 .85 1', 3),
    Box('partition', (.6, 1.9, 1.4), (.09, 1.1, 1.4), '.67 .74 .73 1'),
    Box('sofa_seat', (-2.6, 1.75, .35), (1.05, .55, .35), '.14 .42 .43 1'),
    Box('sofa_back', (-2.6, 2.27, .78), (1.05, .10, .43), '.11 .34 .36 1'),
    Box('cabinet', (3.45, 1.8, 1), (.43, .85, 1), '.56 .37 .23 1'),
    Box('table_top', (-.95, -.15, .78), (.85, .55, .06), '.69 .47 .27 1'),
    Box('table_leg_a', (-1.62, -.52, .36), (.065, .065, .36), '.35 .25 .18 1'),
    Box('table_leg_b', (-.28, -.52, .36), (.065, .065, .36), '.35 .25 .18 1'),
    Box('table_leg_c', (-1.62, .22, .36), (.065, .065, .36), '.35 .25 .18 1'),
    Box('table_leg_d', (-.28, .22, .36), (.065, .065, .36), '.35 .25 .18 1'),
    Box('island', (2.25, -1.25, .48), (.65, .5, .48), '.44 .51 .57 1'),
]
START = np.array([-3.1, -2.1])
HEIGHTS = (.55, 1.15, 1.85, 2.3)
TILTS = (-.65, 0., .65)
RADIUS = .25


def safe_xy(x, y, margin=.04):
    """Conservative swept-cylinder clearance for the entire vertical robot."""
    radius = RADIUS + margin
    if not (-4 + radius < x < 4 - radius and -3 + radius < y < 3 - radius):
        return False
    for b in BOXES[6:]:
        dx = max(abs(x - b.center[0]) - b.half[0], 0)
        dy = max(abs(y - b.center[1]) - b.half[1], 0)
        if dx * dx + dy * dy <= radius * radius:
            return False
    return True


def rotation(yaw, tilt):
    c, s, a, b = math.cos(yaw), math.sin(yaw), math.cos(tilt), math.sin(tilt)
    return np.array([[c*a, -s, c*b], [s*a, c, s*b], [-b, 0, a]])


def camera_axes(index):
    theta = index * math.pi / 2
    fwd = np.array([math.cos(theta), math.sin(theta), 0.])
    right = np.array([math.sin(theta), -math.cos(theta), 0.])
    return fwd, np.column_stack((right, [0., 0., 1.], -fwd))


def scene_xml(environment=None, assets=''):
    geoms = environment if environment is not None else '\n'.join(f'<geom name="{b.name}" type="box" pos="{" ".join(map(str,b.center))}" size="{" ".join(map(str,b.half))}" rgba="{b.color}" group="{b.group}"/>' for b in BOXES)
    cameras = []
    for i in range(4):
        fwd, axes = camera_axes(i)
        pos = ' '.join(map(str, fwd * .105))
        xy = ' '.join(map(str, np.r_[axes[:, 0], axes[:, 1]]))
        cameras.append(f'<camera name="ring_{i}" pos="{pos}" xyaxes="{xy}" fovy="75"/>')
    xml = f'''<mujoco model="room_scanner">
    <compiler angle="radian"/>
    <option gravity="0 0 0"/>
    <visual><global offwidth="960" offheight="640"/><quality shadowsize="2048"/><headlight ambient=".35 .35 .35" diffuse=".6 .6 .6"/></visual>
    <asset><texture name="grid" type="2d" builtin="checker" width="512" height="512" rgb1=".29 .34 .36" rgb2=".34 .39 .41"/><material name="ground" texture="grid" texrepeat="8 6" texuniform="true" reflectance=".05"/>{assets}</asset>
    <worldbody>
    <light pos="-1 0 2.7" dir="0 0 -1" diffuse=".85 .85 .8"/>
    <light pos="3 -2 2.5" dir="-1 1 -1" diffuse=".5 .6 .65"/>
    {geoms}
    <body name="robot" pos="0 0 .12">
      <joint name="base_x" type="slide" axis="1 0 0" limited="false"/>
      <joint name="base_y" type="slide" axis="0 1 0" limited="false"/>
      <joint name="base_yaw" type="hinge" axis="0 0 1" limited="false"/>
      <geom name="base" type="cylinder" size=".25 .10" rgba=".08 .11 .14 1"/>
      <geom type="cylinder" pos="0 0 .105" size=".22 .015" rgba=".12 .71 .63 1"/>
      <geom type="box" pos=".20 0 .115" size=".035 .06 .012" rgba=".75 .98 .83 1"/>
      <geom type="cylinder" pos="0 0 .215" size=".037 .215" rgba=".32 .38 .41 1"/>
      <body name="stage1" pos="0 0 .43">
        <joint name="lift_1" type="slide" axis="0 0 1" range="0 .45"/>
        <geom type="cylinder" pos="0 0 -.23" size=".031 .23" rgba=".5 .58 .6 1"/>
        <body name="stage2">
          <joint name="lift_2" type="slide" axis="0 0 1" range="0 .45"/>
          <geom type="cylinder" pos="0 0 -.23" size=".025 .23" rgba=".65 .73 .75 1"/>
          <body name="stage3">
            <joint name="lift_3" type="slide" axis="0 0 1" range="0 .45"/>
            <geom type="cylinder" pos="0 0 -.23" size=".019 .23" rgba=".77 .82 .83 1"/>
          <body name="stage4">
            <joint name="lift_4" type="slide" axis="0 0 1" range="0 .45"/>
            <geom type="cylinder" pos="0 0 -.23" size=".013 .23" rgba=".80 .85 .86 1"/>
            <body name="gimbal">
              <joint name="tilt" type="hinge" axis="0 1 0" range="-.7 .7"/>
              <geom type="sphere" size=".085" rgba=".08 .6 .55 1"/>
              {''.join(cameras)}
            </body>
          </body>
          </body>
        </body>
      </body>
    </body>
    </worldbody></mujoco>'''
    from .robot import add_robot_visuals
    return add_robot_visuals(xml)


class Navigation:
    """Known-floorplan navigation, 8-neighbour Dijkstra, no corner cutting."""
    resolution = .16

    def __init__(self, xs=None, ys=None, safety=safe_xy, candidates=None, segment_checker=None):
        self.safety=safety
        self.segment_checker=segment_checker
        self.xs = np.asarray(xs) if xs is not None else np.arange(-3.8, 3.81, self.resolution)
        self.ys = np.asarray(ys) if ys is not None else np.arange(-2.8, 2.81, self.resolution)
        if xs is not None:self.resolution=float(self.xs[1]-self.xs[0])
        self.free = np.array([[safety(x,y) for y in self.ys] for x in self.xs])
        self.candidates = candidates if candidates is not None else [np.array([x,y]) for x in np.arange(-3.2,3.3,1.05) for y in np.arange(-2.2,2.3,1.05) if safety(x,y,.12)]

    def cell(self, xy):
        return tuple(np.rint((np.asarray(xy)-[self.xs[0],self.ys[0]])/self.resolution).astype(int))

    def point(self, cell):
        return np.array([self.xs[cell[0]],self.ys[cell[1]]])

    def segment_safe(self, a, b):
        if self.segment_checker is not None:return self.segment_checker(a,b)
        n = max(2,int(np.linalg.norm(np.asarray(b)-a)/.035)+1)
        return all(self.safety(*p) for p in np.linspace(a,b,n))

    def distances(self, xy):
        start = self.cell(xy)
        if not self.free[start]:
            raise ValueError('Start is outside navigation clearance')
        dist, prev = {start:0.}, {}
        queue = [(0.,start)]
        while queue:
            cost, cell = heapq.heappop(queue)
            if cost != dist[cell]:
                continue
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,1),(1,-1),(-1,-1)):
                nxt=(cell[0]+dx,cell[1]+dy)
                if not (0<=nxt[0]<len(self.xs) and 0<=nxt[1]<len(self.ys)) or not self.free[nxt]:
                    continue
                if dx and dy and (not self.free[cell[0]+dx,cell[1]] or not self.free[cell[0],cell[1]+dy]):
                    continue
                value=cost+self.resolution*math.hypot(dx,dy)
                if value<dist.get(nxt,float('inf')):
                    dist[nxt],prev[nxt]=value,cell
                    heapq.heappush(queue,(value,nxt))
        return dist,prev

    def path(self, xy, goal, field=None):
        dist,prev=field if field is not None else self.distances(xy)
        start,end=self.cell(xy),self.cell(goal)
        if end not in dist:
            return None
        cells=[end]
        while cells[-1]!=start:
            cells.append(prev[cells[-1]])
        points=[np.asarray(xy),*[self.point(c) for c in reversed(cells)]]
        if not self.segment_safe(points[-1],goal):
            return None
        points.append(np.asarray(goal))
        if any(not self.segment_safe(a,b) for a,b in zip(points,points[1:])):
            return None
        # Greedy line-of-sight smoothing, with swept clearance checked.
        smooth=[points[0]]
        i=0
        while i<len(points)-1:
            j=len(points)-1
            while j>i+1 and not self.segment_safe(points[i],points[j]):
                j-=1
            smooth.append(points[j]);i=j
        return smooth
