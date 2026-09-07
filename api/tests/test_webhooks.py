def test_github_webhook_rejects_bad_sig(client):
    r = client.post(
        "/webhooks/github",
        json={},
        headers={
            "X-Hub-Signature-256": "sha256=nope",
            "X-GitHub-Event": "pull_request",
        },
    )
    assert r.status_code == 401


def test_revenuecat_webhook_rejects_bad_secret(client):
    r = client.post(
        "/webhooks/revenuecat",
        json={},
        headers={"Authorization": "Bearer wrong"},
    )
    assert r.status_code == 401
