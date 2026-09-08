import time

import httpx

_cache: dict = {}
CACHE_TTL = 60


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
            }
        )
    return out


def _search(token: str, login: str, qualifier: str, extra: str = "") -> list:
    key = (qualifier, login)
    if key in _cache and time.time() - _cache[key][0] < CACHE_TTL:
        return _cache[key][1]
    with gh(token) as c:
        items = c.get(
            "/search/issues",
            params={"q": f"is:pr {qualifier}:@me {extra}".strip(), "per_page": 30},
        ).json()["items"]
        out = _enrich(c, items)
        _cache[key] = (time.time(), out)
        return out


def search_review_requested(token: str, login: str) -> list:
    return _search(token, login, "review-requested", "is:open")


def search_authored(token: str, login: str) -> list:
    return _search(token, login, "author")


def search_reviewed(token: str, login: str) -> list:
    return _search(token, login, "reviewed-by")


def get_pr_files(token: str, owner_repo: str, n: int) -> list:
    with gh(token) as c:
        files = c.get(f"/repos/{owner_repo}/pulls/{n}/files").json()
        return [
            {
                "filename": f["filename"],
                "status": f["status"],
                "additions": f["additions"],
                "deletions": f["deletions"],
            }
            for f in files
        ]


def merge_pr(token: str, owner_repo: str, n: int) -> dict:
    """Returns {ok, sha} or {ok: False, reason: 'already_merged'} — never raises for 405."""
    with gh(token) as c:
        r = c.put(f"/repos/{owner_repo}/pulls/{n}/merge", json={})
        if r.status_code == 405:
            return {"ok": False, "reason": "already_merged"}
        r.raise_for_status()
        return {"ok": True, "sha": r.json().get("sha")}
