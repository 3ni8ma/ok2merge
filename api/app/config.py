import os


def env(name: str) -> str:
    v = os.environ.get(name, "")
    assert v, f"missing env {name}"
    return v


SUPABASE_URL = env("SUPABASE_URL")
SUPABASE_SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_JWT_SECRET = env("SUPABASE_JWT_SECRET")
