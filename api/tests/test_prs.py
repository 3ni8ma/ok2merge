import json


def test_inbox_maps_search_items(client, auth_header, respx_mock, monkeypatch):
    raw = json.load(open("api/tests/fixtures/search.json"))
    raw["items"].append(
        {
            "number": 7,
            "title": "SYNTHETIC fixture item (runtime-injected)",
            "user": {"login": "octo"},
            "repository_url": "https://api.github.com/repos/octo/hello-world",
        }
    )
    respx_mock.get(
        url__regex=r"https://api\.github\.com/search/issues.*"
    ).respond(200, json=raw)
    respx_mock.get(
        url__regex=r"https://api\.github\.com/repos/.*/pulls/\d+$"
    ).respond(200, json={"head": {"sha": "abc123"}, "user": {"login": "octo"}})
    monkeypatch.setattr(
        "app.routes.prs.read_github_token", lambda uid: ("gh-token", "octo")
    )
    r = client.get("/api/prs", headers=auth_header)
    assert r.status_code == 200
    prs = r.json()["prs"]
    assert prs == [
        {
            "repo": "octo/hello-world",
            "number": 7,
            "title": "SYNTHETIC fixture item (runtime-injected)",
            "author": "octo",
            "head_sha": "abc123",
        }
    ]
