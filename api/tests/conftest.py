import pytest
from fastapi.testclient import TestClient

from app import deps
from app.main import app


@pytest.fixture()
def client():
    app.dependency_overrides[deps.get_current_user] = lambda: "test-user-id"
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_header():
    return {"Authorization": "Bearer test-token"}
