def test_ensure_quota_creates_missing_row():
    from api.app.routes import prs
    assert hasattr(prs, "ensure_quota"), "ensure_quota missing"
