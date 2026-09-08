def _auth(monkeypatch):
    import app.routes.prs as prs_mod

    monkeypatch.setattr(prs_mod, "read_github_token", lambda uid: ("t", "octo"))


def test_mentions_uses_involves_qualifier(client, auth_header, respx_mock, monkeypatch):
    _auth(monkeypatch)
    respx_mock.get(url__regex=r"https://api\.github\.com/search/issues.*").respond(
        200, json={"items": []}
    )
    r = client.get("/api/prs/mentions", headers=auth_header)
    assert r.json() == {"prs": []}
    assert "involves" in str(respx_mock.calls[0].request.url)


def test_checks_lists_runs(client, auth_header, respx_mock, monkeypatch):
    _auth(monkeypatch)
    respx_mock.get(
        url__regex=r"https://api\.github\.com/repos/o/r/actions/runs.*"
    ).respond(
        200,
        json={
            "workflow_runs": [
                {"id": 99, "name": "ci", "status": "completed", "conclusion": "failure"}
            ]
        },
    )
    r = client.get("/api/prs/o/r/7/checks?sha=abc", headers=auth_header)
    assert r.json() == {
        "runs": [{"id": 99, "name": "ci", "status": "completed", "conclusion": "failure"}]
    }


def test_rerun_posts_failed_jobs(client, auth_header, respx_mock, monkeypatch):
    _auth(monkeypatch)
    route = respx_mock.post(
        "https://api.github.com/repos/o/r/actions/runs/99/rerun-failed-jobs"
    ).respond(201, json={})
    r = client.post(
        "/api/prs/rerun", json={"repo": "o/r", "run_id": 99}, headers=auth_header
    )
    assert r.json() == {"ok": True}
    assert route.called


def test_reviewers_and_labels(client, auth_header, respx_mock, monkeypatch):
    _auth(monkeypatch)
    respx_mock.post(
        "https://api.github.com/repos/o/r/pulls/7/requested_reviewers"
    ).respond(201, json={})
    respx_mock.put("https://api.github.com/repos/o/r/issues/7/labels").respond(
        200, json=[{"name": "bug"}]
    )
    r1 = client.post(
        "/api/prs/reviewers",
        json={"repo": "o/r", "number": 7, "reviewers": ["amy"]},
        headers=auth_header,
    )
    assert r1.json() == {"ok": True}
    r2 = client.put(
        "/api/prs/labels",
        json={"repo": "o/r", "number": 7, "labels": ["bug"]},
        headers=auth_header,
    )
    assert r2.json() == {"ok": True, "labels": ["bug"]}
