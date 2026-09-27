import httpx


def test_gh_raise_maps_401_and_403_rate():
    from api.app.github import gh_raise
    r401 = httpx.Response(401, request=httpx.Request("GET", "https://x"))
    try:
        gh_raise(r401, "inbox")
        assert False
    except Exception as e:
        assert "reconnect" in str(e).lower()
    r403 = httpx.Response(
        403,
        request=httpx.Request("GET", "https://x"),
        headers={"X-RateLimit-Remaining": "0", "Retry-After": "60"},
    )
    try:
        gh_raise(r403, "inbox")
        assert False
    except Exception as e:
        assert "60" in str(e) or "rate" in str(e).lower()
