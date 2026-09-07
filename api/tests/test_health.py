from fastapi.testclient import TestClient

from app.main import app


def test_health():
    assert TestClient(app).get("/health").json() == {"ok": True}


def test_protected_rejects_no_token():
    r = TestClient(app).get("/api/prs")
    assert r.status_code == 401
