import hmac
import json
from types import SimpleNamespace

import pytest


def test_webhook_secrets_fail_closed(monkeypatch):
    import app.routes.webhooks as w

    # Reload-free: exercise assert_secrets_configured() directly against the
    # live module instead of importlib.reload (reload would leave GH_SECRET
    # mutated for later tests and imports a duplicate module under api.app.*).
    monkeypatch.setattr(w, "GH_SECRET", "")
    with pytest.raises(RuntimeError, match="fail closed"):
        w.assert_secrets_configured()
    monkeypatch.setattr(w, "GH_SECRET", "x")
    monkeypatch.setattr(w, "RC_SECRET", "")
    with pytest.raises(RuntimeError, match="fail closed"):
        w.assert_secrets_configured()


def test_connect_rejects_login_mismatch(client, auth_header, respx_mock):
    respx_mock.get("https://api.github.com/user").respond(
        200, json={"login": "real-octo"}
    )
    r = client.post(
        "/api/github/connect",
        json={"token": "good", "login": "impostor"},
        headers=auth_header,
    )
    assert r.status_code == 400


def test_connect_accepts_matching_login_case_insensitive(
    client, auth_header, respx_mock, monkeypatch
):
    import app.routes.github_connect as gc

    respx_mock.get("https://api.github.com/user").respond(
        200, json={"login": "Real-Octo"}
    )
    monkeypatch.setattr(gc, "store_github_token", lambda *a: None)

    class FakeQuery:
        def upsert(self, *a, **k):
            return self

        def execute(self):
            class R:
                data = None

            return R()

    class FakeSb:
        def table(self, name):
            return FakeQuery()

    monkeypatch.setattr(gc, "sb", FakeSb())
    r = client.post(
        "/api/github/connect",
        json={"token": "good", "login": "real-octo"},
        headers=auth_header,
    )
    assert r.status_code == 200


def test_github_webhook_batches_lookups_and_queues_push(client, monkeypatch):
    import app.routes.webhooks as w

    in_calls = []

    class FakeQuery:
        def __init__(self, rows):
            self._rows = rows

        def select(self, *a):
            return self

        def in_(self, col, vals):
            in_calls.append((col, list(vals)))
            return self

        def execute(self):
            return SimpleNamespace(data=self._rows)

    class FakeSb:
        def table(self, name):
            if name == "github_tokens":
                return FakeQuery([{"user_id": "u1", "github_login": "octo"}])
            assert name == "push_tokens"
            return FakeQuery([{"user_id": "u1", "fcm_token": "tok1"}])

    monkeypatch.setattr(w, "sb", FakeSb())
    queued = []
    monkeypatch.setattr(
        w, "_push_one", lambda uid, tok, body: queued.append((uid, tok, body))
    )

    payload = {
        "action": "opened",
        "pull_request": {
            "number": 7,
            "user": {"login": "octo"},
            "base": {"repo": {"full_name": "o/r"}},
        },
        "requested_reviewers": [],
    }
    raw = json.dumps(payload).encode()
    sig = "sha256=" + hmac.new(b"x", raw, "sha256").hexdigest()
    r = client.post(
        "/webhooks/github",
        content=raw,
        headers={
            "Content-Type": "application/json",
            "X-Hub-Signature-256": sig,
            "X-GitHub-Event": "pull_request",
        },
    )
    assert r.status_code == 200
    assert r.json() == {"ok": True, "pushed": 1}
    assert ("github_login", ["octo"]) in in_calls
    assert ("user_id", ["u1"]) in in_calls
    assert queued == [("u1", "tok1", "A PR needs your review")]
