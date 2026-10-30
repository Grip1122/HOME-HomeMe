from pathlib import Path

import pytest

from server.app import layoutlib as L

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def layout():
    return L.load_json(ROOT / "contracts" / "layout.example.json")


@pytest.fixture()
def index(layout):
    return L.Index(layout)
