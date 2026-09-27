from supabase import create_client

from .config import SUPABASE_SERVICE_KEY, SUPABASE_URL

_sb = None


def _get_sb():
    global _sb
    if _sb is None:
        _sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _sb


class _LazySb:
    """Defers create_client until first attribute use; preserves `sb` import."""

    def __getattr__(self, name):
        return getattr(_get_sb(), name)


sb = _LazySb()


def store_github_token(user_id: str, token: str, login: str) -> None:
    secret_id = _get_sb().rpc("vault_create_secret", {"p_secret": token}).execute().data
    _get_sb().table("github_tokens").upsert(
        {"user_id": user_id, "secret_id": secret_id, "github_login": login}
    ).execute()


def read_github_token(user_id: str):
    row = (
        _get_sb().table("github_tokens")
        .select("secret_id,github_login")
        .eq("user_id", user_id)
        .single()
        .execute()
        .data
    )
    if not row:
        return None
    secret = (
        _get_sb().rpc("vault_read_secret", {"p_secret_id": row["secret_id"]}).execute().data
    )
    return secret, row["github_login"]
