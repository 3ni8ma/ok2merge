# Backend Efficiency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kill list N+1, bound cache, atomize quota, map GitHub errors, harden webhooks.

**Architecture:** Async enrich with semaphore, bounded TTLCache keyed by token hash, single-RPC quota, centralized gh_raise mapper, batched webhook fan-out.

**Tech Stack:** FastAPI, httpx AsyncClient, Supabase (Postgres), pytest with dummy env.

**Spec:** `docs/superpowers/specs/2026-09-27-ok2merge-harden-design.md` (Sections 1,3,4,5 backend parts)

## Global Constraints

- $0 spend, no new infra.
- 60s list-cache discipline preserved.
- Phone never holds GitHub token; AI key server-only.
- Summary cache key stays (user_id, repo, pr_number, head_sha), 30-day TTL.
- `pytest` must give clear message with dummy env, never import AssertionError crash.
- Every GitHub call uses raise_for_status + gh_raise mapping.

---

### Task 1: Test boot + clean config error

**Files:**
- Modify: `api/app/config.py`
- Create: `api/.env.example`
- Test: `api/tests/test_config_boot.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `env(name: str) -> str` raising RuntimeError with message (used by all tasks).

- [ ] **Step 1: Write the failing test**

```python
def test_env_missing_gives_runtime_error():
    import os
    from api.app import config as c
    saved = os.environ.pop("SUPABASE_URL", None)
    try:
        try:
            c.env("SUPABASE_URL")
            assert False, "should have raised"
        except RuntimeError as e:
            assert "SUPABASE_URL" in str(e)
    finally:
        if saved is not None:
            os.environ["SUPABASE_URL"] = saved
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SUPABASE_URL=d SUPABASE_SERVICE_ROLE_KEY=d python -m pytest api/tests/test_config_boot.py -v`
Expected: FAIL with "file not found / function not defined" (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

```python
import os


def env(name: str) -> str:
    v = os.environ.get(name, "")
    if not v:
        raise RuntimeError(f"missing env {name} — copy api/.env.example to api/.env")
    return v


SUPABASE_URL = env("SUPABASE_URL")
SUPABASE_SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY")
```

Replace full contents of `api/app/config.py` with the above (keeps same exported names, changes AssertionError to RuntimeError with hint).

Create `api/.env.example`:
```
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service-role-key-here
GEMINI_API_KEY=gemini-key-here
GITHUB_WEBHOOK_SECRET=local-dev-secret
REVENUECAT_WEBHOOK_SECRET=local-dev-secret
```

- [ ] **Step 4: Run test to verify it passes**

Run: `SUPABASE_URL=d SUPABASE_SERVICE_ROLE_KEY=d python -m pytest api/tests/test_config_boot.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/config.py api/.env.example api/tests/test_config_boot.py
git commit -m "fix(api): clean config boot error + env example"
```

### Task 2: gh_raise mapper + raise_for_status + pagination

**Files:**
- Modify: `api/app/github.py:1-20`
- Test: `api/tests/test_gh_errors.py`

**Interfaces:**
- Consumes: `env` from Task 1 (nothing direct).
- Produces: `gh_raise(r: httpx.Response, context: str) -> None` raising RuntimeError subclasses mapped by callers to HTTPException; `get_pr_files(token, owner_repo, n, page=1, per_page=30)` paginated; `get_check_runs(token, owner_repo, sha, per_page=30)` paginated.

- [ ] **Step 1: Write the failing test**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SUPABASE_URL=d SUPABASE_SERVICE_ROLE_KEY=d python -m pytest api/tests/test_gh_errors.py -v`
Expected: FAIL with "gh_raise not defined / import error".

- [ ] **Step 3: Write minimal implementation**

Add to top of `api/app/github.py` after imports:

```python
class GitHubAuthError(RuntimeError):
    pass


class GitHubRateError(RuntimeError):
    def __init__(self, retry_after: str):
        super().__init__(f"github rate limited, retry after {retry_after}s")
        self.retry_after = retry_after


class GitHubNotFoundError(RuntimeError):
    pass


def gh_raise(r: httpx.Response, context: str) -> None:
    if r.status_code < 400:
        return
    if r.status_code == 401:
        raise GitHubAuthError(f"github unauthorized in {context}: reconnect GitHub")
    if r.status_code == 403 and r.headers.get("X-RateLimit-Remaining") == "0":
        raise GitHubRateError(r.headers.get("Retry-After", "60"))
    if r.status_code == 404:
        raise GitHubNotFoundError(f"github not found in {context}")
    r.raise_for_status()
```

Update `get_pr_files` to accept pagination:

```python
def get_pr_files(token: str, owner_repo: str, n: int, page: int = 1, per_page: int = 30) -> list:
    with gh(token) as c:
        r = c.get(f"/repos/{owner_repo}/pulls/{n}/files", params={"page": page, "per_page": per_page})
        gh_raise(r, "files")
        files = r.json()
        return [
            {
                "filename": f["filename"],
                "status": f["status"],
                "additions": f["additions"],
                "deletions": f["deletions"],
            }
            for f in files
        ]
```

Update `get_check_runs` similarly with `params={"head_sha": sha, "per_page": 30}` + `gh_raise(r, "checks")`.

- [ ] **Step 4: Run test to verify it passes**

Run: `SUPABASE_URL=d SUPABASE_SERVICE_ROLE_KEY=d python -m pytest api/tests/test_gh_errors.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/github.py api/tests/test_gh_errors.py
git commit -m "fix(api): gh error mapper + paginated files/checks"
```

### Task 3: Async enrich + bounded cache

**Files:**
- Modify: `api/app/github.py:5-81`
- Modify: `api/app/deps.py`
- Test: `api/tests/test_enrich_async.py`

**Interfaces:**
- Consumes: `gh_raise` from Task 2.
- Produces: `async def enrich_async(token, items) -> list` (same rich dict shape as `_enrich`); `_cache` is TTLCache(maxsize=512, ttl=60) keyed `(token_hash, qualifier, login)`; `get_current_user` cached 60s via `_user_cache: dict[user_token_hash -> (time, user_id)]`.

- [ ] **Step 1: Write the failing test**

```python
import asyncio


def test_enrich_async_shape_and_cache_key():
    from api.app import github as g
    assert hasattr(g, "enrich_async"), "enrich_async missing"
    assert hasattr(g, "_cache"), "_cache missing"
    assert getattr(g._cache, "maxsize", 0) == 512, "cache must be bounded 512"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SUPABASE_URL=d SUPABASE_SERVICE_ROLE_KEY=d python -m pytest api/tests/test_enrich_async.py -v`
Expected: FAIL with "enrich_async missing".

- [ ] **Step 3: Write minimal implementation**

In `api/app/github.py`, replace `_cache: dict = {}` with:

```python
import asyncio
import hashlib

from cachetools import TTLCache

_cache: TTLCache = TTLCache(maxsize=512, ttl=60)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()[:16]


async def enrich_async(token: str, items: list) -> list:
    import httpx as _hx

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    sem = asyncio.Semaphore(8)

    async def one(it: dict) -> dict:
        owner_repo = it["repository_url"].split("repos/")[1]
        num = it["number"]
        async with sem:
            async with _hx.AsyncClient(
                base_url="https://api.github.com", headers=headers, timeout=20
            ) as ac:
                r = await ac.get(f"/repos/{owner_repo}/pulls/{num}")
                gh_raise(r, "enrich")
                pr = r.json()
        return {
            "repo": owner_repo,
            "number": num,
            "title": it["title"],
            "author": it["user"]["login"],
            "author_avatar": pr["user"].get("avatar_url"),
            "head_sha": pr["head"]["sha"],
            "state": "merged"
            if pr.get("merged_at")
            else ("closed" if pr.get("state") == "closed" else "open"),
            "draft": bool(pr.get("draft")),
            "merged_at": pr.get("merged_at"),
            "created_at": pr.get("created_at"),
            "comments": pr.get("comments", 0) + pr.get("review_comments", 0),
            "additions": pr.get("additions", 0),
            "deletions": pr.get("deletions", 0),
            "changed_files": pr.get("changed_files", 0),
            "mergeable_state": pr.get("mergeable_state"),
            "labels": [label["name"] for label in pr.get("labels", [])],
        }

    return list(await asyncio.gather(*[one(it) for it in items]))
```

Update `_search` to key `( _token_hash(token), qualifier, login )` and keep sync path calling enrich via `asyncio.run(enrich_async(token, items))` for minimal route churn (routes stay sync in this task; full async routes are follow-up).

Add `cachetools` to `api/requirements.txt` (append line `cachetools==5.5.0`).

In `api/app/deps.py` add 60s user cache:

```python
import hashlib
import time

_user_cache: dict = {}
_USER_TTL = 60


def _uh(tok: str) -> str:
    return hashlib.sha256(tok.encode()).hexdigest()[:16]
```

Wrap `get_current_user`: check `_user_cache.get(_uh(jwt))` fresh → return; else call Supabase and store `(time.time(), user_id)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `SUPABASE_URL=d SUPABASE_SERVICE_ROLE_KEY=d python -m pytest api/tests/test_enrich_async.py api/tests/test_gh_errors.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/github.py api/app/deps.py api/requirements.txt api/tests/test_enrich_async.py
git commit -m "perf(api): async enrich + bounded cache + cached auth"
```

### Task 4: Atomic quota + summary hardening

**Files:**
- Modify: `api/app/routes/prs.py:141-210`
- Modify: `api/app/ai.py`
- Test: `api/tests/test_summary_quota.py`

**Interfaces:**
- Consumes: `gh_raise`, `GitHubAuthError`, `GitHubRateError` from Task 2.
- Produces: `ensure_quota(user_id) -> dict ent` (upsert-if-missing, rollover-if-stale, raise 429 if capped); summary returns `{summary, partial, cached}` with 502/504 on AI/diff failure, never consumes quota on failure.

- [ ] **Step 1: Write the failing test**

```python
def test_ensure_quota_creates_missing_row():
    from api.app.routes import prs
    assert hasattr(prs, "ensure_quota"), "ensure_quota missing"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SUPABASE_URL=d SUPABASE_SERVICE_ROLE_KEY=d python -m pytest api/tests/test_summary_quota.py -v`
Expected: FAIL with "ensure_quota missing".

- [ ] **Step 3: Write minimal implementation**

In `api/app/routes/prs.py` add before `summary`:

```python
from datetime import date


def ensure_quota(user_id: str) -> dict:
    rows = (
        sb.table("entitlements").select("*").eq("user_id", user_id).execute().data
    )
    today = str(date.today())
    if not rows:
        created = (
            sb.table("entitlements")
            .upsert(
                {"user_id": user_id, "tier": "free", "day": today, "summaries_used_today": 0},
                on_conflict="user_id",
            )
            .execute()
            .data
        )
        return created[0]
    ent = rows[0]
    if ent.get("day") != today:
        rolled = (
            sb.table("entitlements")
            .update({"day": today, "summaries_used_today": 0})
            .eq("user_id", user_id)
            .execute()
            .data
        )
        return rolled[0]
    cap = 10**9 if ent.get("tier") == "pro" else BETA_DAILY_CAP
    if (ent.get("summaries_used_today") or 0) >= cap:
        raise HTTPException(429, "daily summary cap reached")
    return ent
```

Rewrite `summary` body after cache-hit check to:

```python
    ent = ensure_quota(user_id)
    try:
        raw_resp = httpx.get(
            f"https://api.github.com/repos/{full}/pulls/{n}",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.diff",
            },
            timeout=30,
        )
        if raw_resp.status_code == 401:
            raise HTTPException(409, "github not connected")
        if raw_resp.status_code == 404:
            raise HTTPException(404, "PR not found")
        raw_resp.raise_for_status()
        raw = raw_resp.text
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(504, "diff fetch failed, retry shortly")
    partial = len(raw) > DIFF_LIMIT
    cut = raw[:DIFF_LIMIT]
    hunk = cut.rfind("\n@@")
    if partial and hunk > DIFF_LIMIT - 2000:
        cut = cut[:hunk]
    try:
        text = summarize(cut)
    except Exception:
        raise HTTPException(502, "summarizer unavailable, retry shortly")
    if not text.startswith("WHAT:"):
        raise HTTPException(502, "summarizer returned bad shape, retry shortly")
    sb.table("summary_cache").upsert(
        {
            "user_id": user_id,
            "repo": full,
            "pr_number": n,
            "head_sha": sha,
            "summary": text,
            "partial": partial,
        },
        on_conflict="user_id,repo,pr_number,head_sha",
    ).execute()
    sb.table("entitlements").update(
        {"summaries_used_today": ent.get("summaries_used_today", 0) + 1}
    ).eq("user_id", user_id).execute()
    return {"summary": text, "partial": partial, "cached": False}
```

In `api/app/ai.py` wrap `summarize` with timeout-safe mapping (keep signature): catch all exceptions and re-raise as RuntimeError("summarizer failed") so route maps to 502.

- [ ] **Step 4: Run test to verify it passes**

Run: `SUPABASE_URL=d SUPABASE_SERVICE_ROLE_KEY=d python -m pytest api/tests/test_summary_quota.py api/tests/test_prs.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/routes/prs.py api/app/ai.py api/tests/test_summary_quota.py
git commit -m "fix(api): atomic quota + hardened summary path"
```

### Task 5: Connect login verify + webhook fail-closed + batch

**Files:**
- Modify: `api/app/routes/github_connect.py`
- Modify: `api/app/routes/webhooks.py:10-11,66-91`
- Test: `api/tests/test_connect_webhook.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: `POST /api/github/connect` rejects mismatched login with 400; `GET /_boot` behavior: importing webhooks with empty secrets raises RuntimeError at startup (fail closed); webhook uses `.in_("github_login", logins)` batch + BackgroundTasks for FCM.

- [ ] **Step 1: Write the failing test**

```python
def test_webhook_secrets_fail_closed():
    import importlib
    import os

    saved_gh = os.environ.get("GITHUB_WEBHOOK_SECRET")
    saved_rc = os.environ.get("REVENUECAT_WEBHOOK_SECRET")
    os.environ.pop("GITHUB_WEBHOOK_SECRET", None)
    os.environ.pop("REVENUECAT_WEBHOOK_SECRET", None)
    try:
        import api.app.routes.webhooks as w

        importlib.reload(w)
        assert w.GH_SECRET == "" or w.RC_SECRET == ""
        try:
            w.assert_secrets_configured()
            assert False, "should have raised"
        except RuntimeError:
            pass
    finally:
        if saved_gh is not None:
            os.environ["GITHUB_WEBHOOK_SECRET"] = saved_gh
        if saved_rc is not None:
            os.environ["REVENUECAT_WEBHOOK_SECRET"] = saved_rc
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SUPABASE_URL=d SUPABASE_SERVICE_ROLE_KEY=d GITHUB_WEBHOOK_SECRET=x REVENUECAT_WEBHOOK_SECRET=y python -m pytest api/tests/test_connect_webhook.py -v`
Expected: FAIL with "assert_secrets_configured missing".

- [ ] **Step 3: Write minimal implementation**

In `api/app/routes/webhooks.py` add:

```python
def assert_secrets_configured() -> None:
    if not GH_SECRET or not RC_SECRET:
        raise RuntimeError("webhook secrets not configured (fail closed)")


try:
    assert_secrets_configured()
except RuntimeError:
    pass
```

Note: keep import-time soft (log) but call `assert_secrets_configured()` at top of both `github_hook` and `rc_hook` so requests 500 fast when misconfigured instead of fail-open signature check with empty key.

Replace per-login loop (lines 67-91) with batch:

```python
    from fastapi import BackgroundTasks

    profs = (
        sb.table("github_tokens")
        .select("user_id,github_login")
        .in_("github_login", sorted(logins))
        .execute()
        .data
    )
    user_ids = [p["user_id"] for p in profs]
    if not user_ids:
        return {"ok": True, "ignored": True}
    toks = (
        sb.table("push_tokens")
        .select("user_id,fcm_token")
        .in_("user_id", user_ids)
        .execute()
        .data
    )
```

Dispatch `_push_one` per token in BackgroundTasks (import BackgroundTasks, add param `bg: BackgroundTasks`, `bg.add_task(_push_one, t["user_id"], t["fcm_token"], body)`), count queued as `pushed`.

In `api/app/routes/github_connect.py`: after validating token with `GET https://api.github.com/user`, compare `me["login"].lower() != body.login.lower()` → raise 400 "login mismatch".

- [ ] **Step 4: Run test to verify it passes**

Run: `SUPABASE_URL=d SUPABASE_SERVICE_ROLE_KEY=d GITHUB_WEBHOOK_SECRET=x REVENUECAT_WEBHOOK_SECRET=y python -m pytest api/tests/test_connect_webhook.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/app/routes/webhooks.py api/app/routes/github_connect.py api/tests/test_connect_webhook.py
git commit -m "fix(api): verify connect login + fail-closed batched webhooks"
```
