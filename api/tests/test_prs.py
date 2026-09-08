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
    ).respond(
        200,
        json={
            "head": {"sha": "abc123"},
            "user": {"login": "octo"},
            "state": "open",
            "draft": False,
            "merged_at": None,
            "created_at": "2026-09-01T00:00:00Z",
            "comments": 2,
            "review_comments": 1,
            "additions": 10,
            "deletions": 4,
            "changed_files": 2,
            "mergeable_state": "clean",
        },
    )
    monkeypatch.setattr(
        "app.routes.prs.read_github_token", lambda uid: ("gh-token", "octo")
    )
    r = client.get("/api/prs", headers=auth_header)
    assert r.status_code == 200
    prs = r.json()["prs"]
    assert len(prs) == 1
    pr = prs[0]
    assert pr["repo"] == "octo/hello-world"
    assert pr["number"] == 7
    assert pr["title"] == "SYNTHETIC fixture item (runtime-injected)"
    assert pr["author"] == "octo"
    assert pr["head_sha"] == "abc123"
    assert pr["state"] == "open"
    assert pr["comments"] == 3
    assert pr["additions"] == 10
    assert pr["mergeable_state"] == "clean"
