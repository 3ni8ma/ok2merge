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


def search_review_requested(token: str, login: str) -> list:
    key = ("inbox", login)
    if key in _cache and time.time() - _cache[key][0] < CACHE_TTL:
        return _cache[key][1]
    with gh(token) as c:
        items = c.get(
            "/search/issues",
            params={
                "q": "is:pr is:open review-requested:@me",
                "per_page": 30,
            },
        ).json()["items"]
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
                }
            )
        _cache[key] = (time.time(), out)
        return out
