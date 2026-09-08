def test_cors_allows_pwa_origin(client):
    r = client.options(
        "/api/prs",
        headers={
            "Origin": "https://ok2merge.vercel.app",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert r.status_code == 200
    assert (
        r.headers.get("access-control-allow-origin")
        == "https://ok2merge.vercel.app"
    )


def test_cors_blocks_unknown_origin(client):
    r = client.options(
        "/api/prs",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in r.headers
