def test_delete_requires_auth():
    from fastapi.testclient import TestClient

    from app.main import app

    assert TestClient(app).delete("/api/account").status_code == 401


def test_delete_wipes_everything(client, auth_header, respx_mock, monkeypatch):
    import app.routes.account as acct_mod

    respx_mock.delete(
        url__regex=r"https://api\.github\.com/applications/.*/grant"
    ).respond(204)

    deleted_tables = []
    deleted_users = []
    monkeypatch.setattr(
        acct_mod, "read_github_token", lambda uid: ("gh-token", "octo")
    )

    class FakeDel:
        def __init__(self, table=None):
            self._table = table

        def delete(self):
            return self

        def eq(self, k, v):
            deleted_tables.append(self._table)
            return self

        def execute(self):
            return self

        @property
        def data(self):
            return []

    class FakeAuth:
        class admin:
            @staticmethod
            def delete_user(uid):
                deleted_users.append(uid)

    class FakeSb:
        def table(self, name):
            return FakeDel(name)

        auth = FakeAuth()

    monkeypatch.setattr(acct_mod, "sb", FakeSb())
    monkeypatch.setenv("GITHUB_CLIENT_ID", "cid")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "csec")

    r = client.delete("/api/account", headers=auth_header)
    assert r.json() == {"ok": True}
    assert sorted(deleted_tables) == sorted(
        [
            "push_tokens",
            "summary_cache",
            "entitlements",
            "idempotency_keys",
            "github_tokens",
            "profiles",
        ]
    )
    assert deleted_users == ["test-user-id"]
