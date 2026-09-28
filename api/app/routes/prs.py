import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..ai import summarize
from ..deps import get_current_user
from ..github import (
    get_check_runs,
    get_pr_comments,
    get_pr_files,
    merge_pr,
    rerun_failed,
    request_reviewers,
    search_authored,
    search_mentions,
    search_review_requested,
    search_reviewed,
    set_labels,
)
from ..store import read_github_token, sb

router = APIRouter()

DIFF_LIMIT = 12000
BETA_DAILY_CAP = 50


def _authed_search(user_id: str, fn):
    found = read_github_token(user_id)
    if not found:
        raise HTTPException(409, "github not connected")
    token, login = found
    return {"prs": fn(token, login)}


@router.get("/api/prs")
def inbox(user_id: str = Depends(get_current_user)):
    return _authed_search(user_id, search_review_requested)


@router.get("/api/prs/authored")
def authored(user_id: str = Depends(get_current_user)):
    return _authed_search(user_id, search_authored)


@router.get("/api/prs/activity")
def activity(user_id: str = Depends(get_current_user)):
    return _authed_search(user_id, search_reviewed)


@router.get("/api/prs/mentions")
def mentions(user_id: str = Depends(get_current_user)):
    return _authed_search(user_id, search_mentions)


@router.get("/api/prs/{owner}/{repo}/{n}/files")
def files(owner: str, repo: str, n: int, user_id: str = Depends(get_current_user)):
    found = read_github_token(user_id)
    if not found:
        raise HTTPException(409, "github not connected")
    token, _ = found
    return {"files": get_pr_files(token, f"{owner}/{repo}", n)}


class MergeBody(BaseModel):
    repo: str
    number: int


class ReviewersBody(BaseModel):
    repo: str
    number: int
    reviewers: list[str]


class LabelsBody(BaseModel):
    repo: str
    number: int
    labels: list[str]


class RerunBody(BaseModel):
    repo: str
    run_id: int


def _authed_token(user_id: str) -> str:
    found = read_github_token(user_id)
    if not found:
        raise HTTPException(409, "github not connected")
    return found[0]


@router.get("/api/prs/{owner}/{repo}/{n}/checks")
def checks(
    owner: str, repo: str, n: int, sha: str = Query(...),
    user_id: str = Depends(get_current_user),
):
    token = _authed_token(user_id)
    return {"runs": get_check_runs(token, f"{owner}/{repo}", sha)}


@router.get("/api/prs/{owner}/{repo}/{n}/comments")
def comments(owner: str, repo: str, n: int, user_id: str = Depends(get_current_user)):
    token = _authed_token(user_id)
    return {"comments": get_pr_comments(token, f"{owner}/{repo}", n)}


@router.post("/api/prs/rerun")
def rerun(b: RerunBody, user_id: str = Depends(get_current_user)):
    token = _authed_token(user_id)
    try:
        return rerun_failed(token, b.repo, b.run_id)
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"github rejected rerun: {e.response.status_code}")


@router.post("/api/prs/reviewers")
def reviewers(b: ReviewersBody, user_id: str = Depends(get_current_user)):
    token = _authed_token(user_id)
    try:
        return request_reviewers(token, b.repo, b.number, b.reviewers)
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"github rejected reviewers: {e.response.status_code}")


@router.put("/api/prs/labels")
def labels(b: LabelsBody, user_id: str = Depends(get_current_user)):
    token = _authed_token(user_id)
    try:
        return set_labels(token, b.repo, b.number, b.labels)
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"github rejected labels: {e.response.status_code}")


@router.post("/api/prs/merge")
def merge(b: MergeBody, user_id: str = Depends(get_current_user)):
    found = read_github_token(user_id)
    if not found:
        raise HTTPException(409, "github not connected")
    token, _ = found
    try:
        return merge_pr(token, b.repo, b.number)
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"github rejected merge: {e.response.status_code}")


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


@router.get("/api/prs/{owner}/{repo}/{n}/summary")
def summary(
    owner: str,
    repo: str,
    n: int,
    sha: str = Query(...),
    user_id: str = Depends(get_current_user),
):
    found = read_github_token(user_id)
    if not found:
        raise HTTPException(409, "github not connected")
    token, _ = found
    full = f"{owner}/{repo}"
    hit = (
        sb.table("summary_cache")
        .select("summary,partial")
        .eq("user_id", user_id)
        .eq("repo", full)
        .eq("pr_number", n)
        .eq("head_sha", sha)
        .execute()
        .data
    )
    if hit:
        return {"summary": hit[0]["summary"], "partial": hit[0]["partial"], "cached": True}
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
