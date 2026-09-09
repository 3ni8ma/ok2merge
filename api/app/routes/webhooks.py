import hmac
import os

from fastapi import APIRouter, Header, HTTPException, Request
from firebase_admin import credentials, initialize_app, messaging

from ..store import sb

router = APIRouter()
GH_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
RC_SECRET = os.environ.get("REVENUECAT_WEBHOOK_SECRET", "")

_fcm = None


def fcm():
    global _fcm
    if _fcm is None:
        initialize_app(
            credentials.Certificate(os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"])
        )
        _fcm = True
    return messaging


@router.post("/webhooks/github")
async def github_hook(
    request: Request,
    event: str = Header("", alias="X-GitHub-Event"),
    sig: str = Header("", alias="X-Hub-Signature-256"),
):
    raw = await request.body()
    want = "sha256=" + hmac.new(GH_SECRET.encode(), raw, "sha256").hexdigest()
    if not hmac.compare_digest(want, sig):
        raise HTTPException(401, "bad signature")
    if event not in (
        "pull_request",
        "pull_request_review",
        "check_run",
        "issue_comment",
    ):
        return {"ok": True, "ignored": True}
    payload = await request.json()
    action = payload.get("action", "")
    pr = payload.get("pull_request") or {}
    logins = {
        (payload.get("requested_reviewer") or {}).get("login"),
        (payload.get("comment") or {}).get("user", {}).get("login"),
        (pr.get("user") or {}).get("login"),
    } | {
        r.get("login")
        for r in payload.get("requested_reviewers") or []
        if r.get("login")
    }
    logins -= {None}
    if not logins:
        return {"ok": True, "ignored": True}
    if action == "synchronize":
        base = pr.get("base") or {}
        repo_name = (base.get("repo") or {}).get("full_name", "a PR")
        ref = f"#{pr['number']}" if pr.get("number") else ""
        body = f"New commits on {repo_name}{ref}"
    else:
        body = "A PR needs your review"
    sent = 0
    for login in logins:
        prof = (
            sb.table("github_tokens")
            .select("user_id")
            .eq("github_login", login)
            .execute()
            .data
        )
        if not prof:
            continue
        toks = (
            sb.table("push_tokens")
            .select("fcm_token")
            .eq("user_id", prof[0]["user_id"])
            .execute()
            .data
        )
        for t in toks:  # FCM fans out to Android directly and to iOS via APNs
            fcm().send(
                messaging.Message(
                    token=t["fcm_token"],
                notification=messaging.Notification(
                    title="OK2Merge", body=body
                ),
                    data={"route": "/"},
                )
            )
            sent += 1
    return {"ok": True, "pushed": sent}


@router.post("/webhooks/revenuecat")
async def rc_hook(request: Request, authorization: str = Header("")):
    if authorization != f"Bearer {RC_SECRET}":
        raise HTTPException(401, "bad secret")
    evt = (await request.json()).get("event", {})
    uid, tier = evt.get("app_user_id"), (
        "pro" if evt.get("type") in ("INITIAL_PURCHASE", "RENEWAL") else "free"
    )
    if uid:
        sb.table("entitlements").upsert({"user_id": uid, "tier": tier}).execute()
    return {"ok": True}
