def test_connect_requires_login_field(client, auth_header):
    r = client.post("/api/github/connect", json={"token": "x"}, headers=auth_header)
    assert r.status_code == 422


def test_connect_rejects_bad_github_token(client, auth_header, respx_mock):
    respx_mock.get("https://api.github.com/user").respond(
        401, json={"message": "bad"}
    )
    r = client.post(
        "/api/github/connect",
        json={"token": "bad", "login": "octo"},
        headers=auth_header,
    )
    assert r.status_code == 502
