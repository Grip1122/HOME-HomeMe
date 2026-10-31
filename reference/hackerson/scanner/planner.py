"""Greedy receding-horizon next-best-view with known-map navigation."""
from dataclasses import dataclass
import numpy as np
from .world import HEIGHTS, TILTS


@dataclass
class Target:
    xy: np.ndarray
    height: float
    tilt: float
    path: list
    gain: int
    score: float
    key: tuple


class Planner:
    def __init__(self, navigation, online_map, strategy='adaptive'):
        self.nav=navigation
        self.map=online_map
        self.strategy=strategy
        self.visited=set()
        self.last_candidates=[]

    def choose(self, xy, height, tilt):
        field=self.nav.distances(xy)
        heights=(1.15,) if self.strategy=='fixed' else HEIGHTS
        pitches=(0.,) if self.strategy=='fixed' else TILTS
        ranked=[]
        for index,point in enumerate(self.nav.candidates):
            cell=self.nav.cell(point)
            distance=field[0].get(cell)
            if distance is None:
                continue
            # Avoid spending the budget on many almost identical heights at one location.
            # This uses executed view history, without consulting ground-truth coverage.
            visits=sum(key[0]==index for key in self.visited)
            novelty=(1+.9*visits)**-1.5
            for h in heights:
                for t in pitches:
                    key=(index,h,t)
                    if key in self.visited:
                        continue
                    gain=self.map.expected_gain(point,h,t)
                    score=gain*novelty/(1+.08*distance+.35*abs(h-height)+.15*abs(t-tilt))
                    ranked.append((score,gain,index,h,t,key))
        ranked.sort(reverse=True)
        self.last_candidates=[{'xy':self.nav.candidates[i].tolist(),'height':h,'tilt':t,'score':round(s,1),'gain':g} for s,g,i,h,t,k in ranked[:5]]
        for score,gain,index,h,t,key in ranked:
            path=self.nav.path(xy,self.nav.candidates[index],field)
            if path is not None:
                return Target(self.nav.candidates[index],h,t,path,gain,score,key)
        return None
