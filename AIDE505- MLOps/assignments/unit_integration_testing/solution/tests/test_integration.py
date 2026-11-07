"""Integration tests: send real HTTP requests through Flask's test client.

These check that routes, templates, sessions and auth.py all work together.
"""


# 1 ── Full happy path: register → login → welcome page
def test_register_then_login_shows_welcome(client, store):
    resp = client.post("/register", data={"username": "bob", "password": "secret123"})
    assert resp.status_code == 302                       # redirect to /login
    assert resp.headers["Location"].endswith("/login")
    assert store.exists("bob")                           # backend really saved it

    resp = client.post(
        "/login",
        data={"username": "bob", "password": "secret123"},
        follow_redirects=True,
    )
    assert resp.status_code == 200
    assert b"Welcome, bob!" in resp.data


# 2 ── Error path: bad credentials are rejected and shown to the user
def test_login_with_wrong_password_fails(client):
    client.post("/register", data={"username": "bob", "password": "secret123"})

    resp = client.post("/login", data={"username": "bob", "password": "wrong-pass1"})

    assert resp.status_code == 401
    assert b"Invalid username or password" in resp.data
    with client.session_transaction() as sess:
        assert "user" not in sess                       # not logged in


# 3 ── Sessions: protected page requires login, logout ends access
def test_welcome_requires_login_and_logout_clears_session(client):
    resp = client.get("/welcome")
    assert resp.status_code == 302
    assert resp.headers["Location"].endswith("/login")

    client.post("/register", data={"username": "bob", "password": "secret123"})
    client.post("/login", data={"username": "bob", "password": "secret123"})
    assert client.get("/welcome").status_code == 200

    client.post("/logout")
    resp = client.get("/welcome")
    assert resp.status_code == 302                       # locked out again


# 4 ── GET: the registration form renders
def test_get_register_shows_form(client):
    resp = client.get("/register")

    assert resp.status_code == 200
    assert b"Create an account" in resp.data


# 5 ── Error path: duplicate username is rejected over HTTP
def test_register_existing_username_fails(client, store):
    client.post("/register", data={"username": "bob", "password": "secret123"})

    resp = client.post("/register", data={"username": "bob", "password": "another123"})

    assert resp.status_code == 400
    assert b"already taken" in resp.data
    assert len(store) == 1                               # no second account saved
