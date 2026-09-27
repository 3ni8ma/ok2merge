import asyncio


def test_enrich_async_shape_and_cache_key():
    from api.app import github as g
    assert hasattr(g, "enrich_async"), "enrich_async missing"
    assert hasattr(g, "_cache"), "_cache missing"
    assert getattr(g._cache, "maxsize", 0) == 512, "cache must be bounded 512"
