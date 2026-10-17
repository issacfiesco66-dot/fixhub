import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.deps import build_deps
from app.main import create_app


def make_settings(**overrides) -> Settings:
    base = dict(
        _env_file=None,
        vision_backend="fake",
        uber_provider="fake",
        api_shared_secret="",
        alert_min_interval_s=0.0,
        frame_min_interval_s=0.0,
    )
    base.update(overrides)
    return Settings(**base)


def make_jpeg(width: int = 64, height: int = 48) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), (40, 40, 40)).save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def settings() -> Settings:
    return make_settings()


@pytest.fixture
def deps(settings):
    return build_deps(settings)


@pytest.fixture
def client(deps, settings):
    app = create_app(deps, settings)
    with TestClient(app) as c:
        yield c
