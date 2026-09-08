import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..ai import summarize
from ..deps import get_current_user
from ..github import (
    get_check_runs,
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
    ent = (
        sb.table("entitlements")
        .select("*")
        .eq("user_id", user_id)
        .single()
        .execute()
        .data
    )
    from datetime import date

    if ent["day"] != str(date.today()):
        ent = (
            sb.table("entitlements")
            .update({"day": str(date.today()), "summaries_used_today": 0})
            .eq("user_id", user_id)
            .execute()
            .data[0]
        )
    cap = 10**9 if ent["tier"] == "pro" else BETA_DAILY_CAP
    if ent["summaries_used_today"] >= cap:
        raise HTTPException(429, "daily summary cap reached")
    raw = httpx.get(
        f"https://api.github.com/repos/{full}/pulls/{n}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.diff",
        },
        timeout=30,
    ).text
    partial = len(raw) > DIFF_LIMIT
    text = summarize(raw[:DIFF_LIMIT])
    sb.table("summary_cache").upsert(
        {
            "user_id": user_id,
            "repo": full,
            "pr_number": n,
            "head_sha": sha,
            "summary": text,
            "partial": partial,
        }
    ).execute()
    sb.table("entitlements").update(
        {"summaries_used_today": ent["summaries_used_today"] + 1}
    ).eq("user_id", user_id).execute()
    return {"summary": text, "partial": partial, "cached": False}
