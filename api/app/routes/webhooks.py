import hmac
import logging
import os

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request
from firebase_admin import credentials, initialize_app, messaging

from ..store import sb

router = APIRouter()
GH_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
RC_SECRET = os.environ.get("REVENUECAT_WEBHOOK_SECRET", "")

logger = logging.getLogger(__name__)

_fcm = None


def assert_secrets_configured() -> None:
    if not GH_SECRET or not RC_SECRET:
        raise RuntimeError("webhook secrets not configured (fail closed)")


try:
    assert_secrets_configured()
except RuntimeError:
    logger.warning("webhook secrets not configured (fail closed)")


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
    bg: BackgroundTasks,
    event: str = Header("", alias="X-GitHub-Event"),
    sig: str = Header("", alias="X-Hub-Signature-256"),
):
    assert_secrets_configured()
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
    for t in toks:  # FCM fans out to Android directly and to iOS via APNs
        bg.add_task(_push_one, t["user_id"], t["fcm_token"], body)
    return {"ok": True, "pushed": len(toks)}


def _push_one(user_id: str, token: str, body: str) -> str:
    """Send one push; never raise. Dead tokens are pruned so one bad
    registration can't 500 the webhook (which would make GitHub retry and
    double-push every valid token)."""
    try:
        fcm().send(
            messaging.Message(
                token=token,
                notification=messaging.Notification(title="OK2Merge", body=body),
                data={"route": "/"},
            )
        )
        return "sent"
    except (messaging.UnregisteredError, messaging.SenderIdMismatchError):
        try:
            sb.table("push_tokens").delete().eq("user_id", user_id).eq(
                "fcm_token", token
            ).execute()
        except Exception:
            pass
        return "invalid"
    except Exception:
        return "failed"


@router.post("/webhooks/revenuecat")
async def rc_hook(request: Request, authorization: str = Header("")):
    assert_secrets_configured()
    if authorization != f"Bearer {RC_SECRET}":
        raise HTTPException(401, "bad secret")
    evt = (await request.json()).get("event", {})
    uid, tier = evt.get("app_user_id"), (
        "pro" if evt.get("type") in ("INITIAL_PURCHASE", "RENEWAL") else "free"
    )
    if uid:
        sb.table("entitlements").upsert({"user_id": uid, "tier": tier}).execute()
    return {"ok": True}
