import logging


def test_token_value_never_logged(caplog):
    with caplog.at_level(logging.INFO):
        logging.getLogger("app.store").info("rotating something")
    assert "ghu_" not in caplog.text and "sk-" not in caplog.text
