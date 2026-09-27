def test_env_missing_gives_runtime_error():
    import os
    from api.app import config as c
    saved = os.environ.pop("SUPABASE_URL", None)
    try:
        try:
            c.env("SUPABASE_URL")
            assert False, "should have raised"
        except RuntimeError as e:
            assert "SUPABASE_URL" in str(e)
    finally:
        if saved is not None:
            os.environ["SUPABASE_URL"] = saved
