import os
from datetime import date

import pytest

DIFF_URL = "https://api.github.com/repos/o/r/pulls/7"


class FakeTable:
    def __init__(self, rows=None):
        self._rows = list(rows or [])
        self.upserted = []
        self.updated = []

    def select(self, *a):
        return self

    def eq(self, k, v):
        self._rows = [r for r in self._rows if r.get(k) == v]
        return self

    def single(self):
        self._single = True
        return self

    def execute(self):
        return self

    @property
    def data(self):
        if getattr(self, "_single", False):
            return self._rows[0] if self._rows else None
        return self._rows

    def upsert(self, row):
        self.upserted.append(row)
        return self

    def update(self, row):
        self.updated.append(row)
        return self


def _tables(cache_rows=None):
    ent = {
        "user_id": "test-user-id",
        "tier": "free",
        "summaries_used_today": 0,
        "day": str(date.today()),
    }
    return {
        "summary_cache": FakeTable(cache_rows),
        "entitlements": FakeTable([ent]),
    }


def test_summary_caches_by_sha(client, auth_header, respx_mock, monkeypatch):
    import app.routes.prs as prs_mod

    respx_mock.get(
        DIFF_URL, headers__contains={"Accept": "application/vnd.github.diff"}
    ).respond(200, text="diff --git a/f b/f\n+x")
    monkeypatch.setattr(prs_mod, "summarize", lambda diff: "WHAT//RISK//CHECK")
    monkeypatch.setattr(prs_mod, "read_github_token", lambda uid: ("t", "octo"))
    tables = _tables()
    monkeypatch.setattr(prs_mod.sb, "table", lambda name: tables[name])

    r1 = client.get("/api/prs/o/r/7/summary?sha=deadbee", headers=auth_header)
    assert r1.status_code == 200, r1.text
    assert r1.json()["cached"] is False
    assert len(tables["summary_cache"].upserted) == 1

    tables2 = _tables(
        [
            {
                "user_id": "test-user-id",
                "summary": "WHAT//RISK//CHECK",
                "partial": False,
                "repo": "o/r",
                "pr_number": 7,
                "head_sha": "deadbee",
            }
        ]
    )
    monkeypatch.setattr(prs_mod.sb, "table", lambda name: tables2[name])
    r2 = client.get("/api/prs/o/r/7/summary?sha=deadbee", headers=auth_header)
    assert r2.json() == {
        "summary": "WHAT//RISK//CHECK",
        "partial": False,
        "cached": True,
    }


@pytest.mark.skipif(
    os.environ.get("RUN_LIVE_AI") != "1", reason="needs live AI quota"
)
def test_golden_summaries_have_three_labeled_lines():
    import glob

    from app.ai import summarize

    diffs = sorted(glob.glob("api/tests/fixtures/golden/*.diff"))
    assert diffs, "no golden diffs"
    for path in diffs:
        text = summarize(open(path).read())
        lines = [ln for ln in text.splitlines() if ln.strip()]
        assert len(lines) == 3, f"{path}: {text!r}"
        assert lines[0].startswith("WHAT:")
        assert lines[1].startswith("RISK:")
        assert lines[2].startswith("CHECK:")
