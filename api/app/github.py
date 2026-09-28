import asyncio
import hashlib

import httpx
from cachetools import TTLCache


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


_cache: TTLCache = TTLCache(maxsize=512, ttl=60)
CACHE_TTL = 60


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()[:16]


def gh(token: str) -> httpx.Client:
    return httpx.Client(
        base_url="https://api.github.com",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=20,
    )


def _enrich(c: httpx.Client, items: list) -> list:
    """One pulls-API fetch per item → shared rich PR dict for all lists."""
    out = []
    for it in items:
        owner_repo = it["repository_url"].split("repos/")[1]
        num = it["number"]
        pr = c.get(f"/repos/{owner_repo}/pulls/{num}").json()
        out.append(
            {
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
        )
    return out


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


def _search(token: str, login: str, qualifier: str, extra: str = "") -> list:
    key = (_token_hash(token), qualifier, login)
    if key in _cache:
        return _cache[key]
    with gh(token) as c:
        items = c.get(
            "/search/issues",
            params={"q": f"is:pr {qualifier}:@me {extra}".strip(), "per_page": 30},
        ).json()["items"]
        out = asyncio.run(enrich_async(token, items))
        _cache[key] = out
        return out


def search_review_requested(token: str, login: str) -> list:
    return _search(token, login, "review-requested", "is:open")


def search_authored(token: str, login: str) -> list:
    return _search(token, login, "author")


def search_reviewed(token: str, login: str) -> list:
    return _search(token, login, "reviewed-by")


def search_mentions(token: str, login: str) -> list:
    # `involves:` (mentions, assignments, authorship) supports @me; `mentions:` does not.
    return _search(token, login, "involves")


def get_check_runs(token: str, owner_repo: str, sha: str, per_page: int = 30) -> list:
    """Workflow runs for a commit — directly re-runnable, unlike raw check-runs."""
    with gh(token) as c:
        r = c.get(
            f"/repos/{owner_repo}/actions/runs",
            params={"head_sha": sha, "per_page": per_page},
        )
        gh_raise(r, "checks")
        runs = r.json()["workflow_runs"]
        return [
            {
                "id": r["id"],
                "name": r["name"],
                "status": r["status"],
                "conclusion": r.get("conclusion"),
            }
            for r in runs
        ]


def rerun_failed(token: str, owner_repo: str, run_id: int) -> dict:
    with gh(token) as c:
        r = c.post(f"/repos/{owner_repo}/actions/runs/{run_id}/rerun-failed-jobs")
        r.raise_for_status()
        return {"ok": True}


def request_reviewers(token: str, owner_repo: str, n: int, reviewers: list) -> dict:
    with gh(token) as c:
        r = c.post(
            f"/repos/{owner_repo}/pulls/{n}/requested_reviewers",
            json={"reviewers": reviewers},
        )
        r.raise_for_status()
        return {"ok": True}


def set_labels(token: str, owner_repo: str, n: int, labels: list) -> dict:
    with gh(token) as c:
        r = c.put(f"/repos/{owner_repo}/issues/{n}/labels", json={"labels": labels})
        r.raise_for_status()
        return {"ok": True, "labels": [label["name"] for label in r.json()]}


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


def get_pr_comments(token: str, owner_repo: str, n: int, per_page: int = 30) -> list:
    with gh(token) as c:
        r = c.get(f"/repos/{owner_repo}/issues/{n}/comments", params={"per_page": per_page})
        gh_raise(r, "comments")
        return [
            {
                "id": m["id"],
                "user": m["user"]["login"],
                "avatar": m["user"].get("avatar_url"),
                "body": (m.get("body") or "")[:500],
                "created_at": m.get("created_at"),
            }
            for m in r.json()
        ]


def merge_pr(token: str, owner_repo: str, n: int) -> dict:
    """Returns {ok, sha} or {ok: False, reason: 'already_merged'} — never raises for 405."""
    with gh(token) as c:
        r = c.put(f"/repos/{owner_repo}/pulls/{n}/merge", json={})
        if r.status_code == 405:
            return {"ok": False, "reason": "already_merged"}
        r.raise_for_status()
        return {"ok": True, "sha": r.json().get("sha")}
