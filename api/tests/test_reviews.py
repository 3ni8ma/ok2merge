def test_rejects_non_allowlisted_event(client, auth_header):
    r = client.post(
        "/api/reviews",
        json={"repo": "o/r", "number": 1, "event": "MERGE", "key": "k1"},
        headers=auth_header,
    )
    assert r.status_code == 422


def test_double_post_returns_same_without_regithub(
    client, auth_header, respx_mock, monkeypatch
):
    import app.routes.reviews as rev_mod

    route = respx_mock.post(
        "https://api.github.com/repos/o/r/pulls/1/reviews"
    ).respond(200, json={"id": 9})
    monkeypatch.setattr(rev_mod, "read_github_token", lambda uid: ("t", "octo"))

    posted = []

    class FakeIdem:
        def select(self, *a):
            return self

        def eq(self, k, v):
            return self

        def execute(self):
            return self

        @property
        def data(self):
            return list(posted)

        def insert(self, row):
            posted.append(row)
            return self

    monkeypatch.setattr(rev_mod.sb, "table", lambda name: FakeIdem())
    body = {"repo": "o/r", "number": 1, "event": "APPROVE", "key": "k2"}
    r1 = client.post("/api/reviews", json=body, headers=auth_header)
    r2 = client.post("/api/reviews", json=body, headers=auth_header)
    assert r1.json() == r2.json() == {"ok": True, "id": 9}
    assert route.call_count == 1
