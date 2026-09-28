def test_comments_endpoint_exists():
    from api.app.routes import prs
    routes = [r.path for r in prs.router.routes]
    assert "/api/prs/{owner}/{repo}/{n}/comments" in routes
