import json

ITEM = {
    "number": 7,
    "title": "SYNTHETIC",
    "user": {"login": "octo"},
    "repository_url": "https://api.github.com/repos/octo/hello-world",
}

PULL = {
    "head": {"sha": "abc123"},
    "user": {"login": "octo", "avatar_url": "https://example.com/octo.png"},
    "state": "open",
    "draft": False,
    "merged_at": None,
    "created_at": "2026-09-01T00:00:00Z",
    "comments": 0,
    "review_comments": 0,
    "additions": 5,
    "deletions": 1,
    "changed_files": 1,
    "mergeable_state": "clean",
}


def _mock(monkeypatch, respx_mock, search_json=None):
    import app.routes.prs as prs_mod

    respx_mock.get(url__regex=r"https://api\.github\.com/search/issues.*").respond(
        200, json=search_json or {"items": [ITEM]}
    )
    respx_mock.get(
        url__regex=r"https://api\.github\.com/repos/.*/pulls/\d+$"
    ).respond(200, json=PULL)
    monkeypatch.setattr(prs_mod, "read_github_token", lambda uid: ("t", "octo"))


def test_authored_uses_author_qualifier(client, auth_header, respx_mock, monkeypatch):
    _mock(monkeypatch, respx_mock)
    r = client.get("/api/prs/authored", headers=auth_header)
    assert r.status_code == 200
    assert r.json()["prs"][0]["repo"] == "octo/hello-world"
    q = str(respx_mock.calls[0].request.url)
    assert "author" in q


def test_activity_uses_reviewed_by_qualifier(
    client, auth_header, respx_mock, monkeypatch
):
    _mock(monkeypatch, respx_mock)
    r = client.get("/api/prs/activity", headers=auth_header)
    assert r.status_code == 200
    q = str(respx_mock.calls[0].request.url)
    assert "reviewed-by" in q


def test_files_lists_changes(client, auth_header, respx_mock, monkeypatch):
    import app.routes.prs as prs_mod

    respx_mock.get(
        "https://api.github.com/repos/octo/hello-world/pulls/7/files"
    ).respond(
        200,
        json=[
            {
                "filename": "a.py",
                "status": "modified",
                "additions": 5,
                "deletions": 1,
            }
        ],
    )
    monkeypatch.setattr(prs_mod, "read_github_token", lambda uid: ("t", "octo"))
    r = client.get("/api/prs/octo/hello-world/7/files", headers=auth_header)
    assert r.json() == {
        "files": [
            {"filename": "a.py", "status": "modified", "additions": 5, "deletions": 1}
        ]
    }


def test_merge_ok_and_already_merged(client, auth_header, respx_mock, monkeypatch):
    import app.routes.prs as prs_mod

    respx_mock.put(
        "https://api.github.com/repos/octo/hello-world/pulls/7/merge"
    ).respond(200, json={"sha": "deadbee", "merged": True})
    respx_mock.put(
        "https://api.github.com/repos/octo/hello-world/pulls/8/merge"
    ).respond(405, json={"message": "already merged"})
    monkeypatch.setattr(prs_mod, "read_github_token", lambda uid: ("t", "octo"))
    r1 = client.post(
        "/api/prs/merge",
        json={"repo": "octo/hello-world", "number": 7},
        headers=auth_header,
    )
    assert r1.json() == {"ok": True, "sha": "deadbee"}
    r2 = client.post(
        "/api/prs/merge",
        json={"repo": "octo/hello-world", "number": 8},
        headers=auth_header,
    )
    assert r2.json() == {"ok": False, "reason": "already_merged"}


def test_webhook_fans_out_to_author(client, respx_mock, monkeypatch):
    import app.routes.webhooks as wh_mod

    sent = []

    class FakeTable:
        def __init__(self, rows=None):
            self._rows = list(rows or [])

        def select(self, *a):
            return self

        def eq(self, k, v):
            self._rows = [r for r in self._rows if r.get(k) == v]
            return self

        def execute(self):
            return self

        @property
        def data(self):
            return self._rows

    tables = {
        "github_tokens": FakeTable(
            [{"user_id": "u-author", "github_login": "octo"}]
        ),
        "push_tokens": FakeTable(
            [{"user_id": "u-author", "fcm_token": "tok123"}]
        ),
    }
    monkeypatch.setattr(wh_mod, "sb", type("S", (), {"table": staticmethod(lambda n: tables[n])})())
    monkeypatch.setattr(
        wh_mod, "fcm", lambda: type("F", (), {"send": staticmethod(lambda m: sent.append(m.token))})()
    )
    import hmac, os

    body = json.dumps(
        {"action": "opened", "pull_request": {"user": {"login": "octo"}}}
    ).encode()
    sig = "sha256=" + hmac.new(
        os.environ.get("GITHUB_WEBHOOK_SECRET", "").encode(), body, "sha256"
    ).hexdigest()
    r = client.post(
        "/webhooks/github",
        content=body,
        headers={
            "X-GitHub-Event": "pull_request",
            "X-Hub-Signature-256": sig,
            "Content-Type": "application/json",
        },
    )
    assert r.json() == {"ok": True, "pushed": 1}
    assert sent == ["tok123"]
