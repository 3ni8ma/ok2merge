from supabase import create_client

from .config import SUPABASE_SERVICE_KEY, SUPABASE_URL

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def store_github_token(user_id: str, token: str, login: str) -> None:
    secret_id = sb.rpc("vault_create_secret", {"p_secret": token}).execute().data
    sb.table("github_tokens").upsert(
        {"user_id": user_id, "secret_id": secret_id, "github_login": login}
    ).execute()


def read_github_token(user_id: str):
    row = (
        sb.table("github_tokens")
        .select("secret_id,github_login")
        .eq("user_id", user_id)
        .single()
        .execute()
        .data
    )
    if not row:
        return None
    secret = (
        sb.rpc("vault_read_secret", {"p_secret_id": row["secret_id"]}).execute().data
    )
    return secret, row["github_login"]
