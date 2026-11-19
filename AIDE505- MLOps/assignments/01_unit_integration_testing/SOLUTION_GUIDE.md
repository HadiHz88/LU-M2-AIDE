# Testing a Python Web App with pytest: solution guide

This lab builds a pytest suite for a small Flask app where users register, log in and log out. You
start from `starter.zip`, which already has the app and the six tests the handout walks through.
`solution/` holds only the two test files you change: `tests/test_unit.py` and
`tests/test_integration.py`, with the starter's tests kept and four new tests added for the
exercises.

## 1. The project

The starter has its files at the root of the zip, not inside a `testing-guide/` folder, so give it
a folder when you unzip it:

```bash
unzip starter.zip -d testing-guide
cd testing-guide
```

If your unzip tool also creates a `__MACOSX/` folder, delete it. It only holds macOS metadata.

The two Python files are split on purpose. `auth.py` is the business logic (validation, hashing,
the `UserStore`) and never imports Flask. `app.py` is the web layer. It builds the app through a
factory that accepts a store from outside:

`app.py`

```python
def create_app(store: UserStore | None = None, testing: bool = False) -> Flask:
    """App factory: every call returns a fresh app with its own in-memory store."""
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-only-secret")
    app.config["TESTING"] = testing
    users = store if store is not None else UserStore()
```

That `store` parameter is what makes the integration tests possible: a test creates the store,
hands it to the app, and can look inside it after an HTTP request.

## 2. Setup and run the app locally

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

You really need Python 3.10 or later. `auth.py` uses the annotation `bytes | None`, and on
Python 3.9 the import fails with a `TypeError`, so neither the app nor the tests can start. The
solution was run with Python 3.12 (Flask 3.1.3, pytest 9.2.0, pytest-cov 7.1.0).

Open http://127.0.0.1:5000, create an account, log in, log out, then stop the server with Ctrl+C.

**Try it: register with password `abc`.**
The page shows *"Password must be at least 8 characters"*. It comes from `validate_password()`
in `auth.py`:

`auth.py`

```python
def validate_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise AuthError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    if not any(c.isdigit() for c in password):
        raise AuthError("Password must contain at least one digit")
```

`UserStore.register()` calls it after the username has passed `validate_username()`. The
`/register` route catches the `AuthError`, flashes its message and returns status 400.

## 3. Unit vs integration

Nothing to code here, but keep the split in mind, because it decides where each new test goes:

- A **unit test** imports from `auth.py` and calls it directly. No Flask, no HTTP.
- An **integration test** sends requests through Flask's test client, so it goes through
  `app.py`, the session, the templates and `auth.py` together.

Every test in the solution follows Arrange, Act, Assert. The blank lines inside each test
separate the three parts.

## 4. Fixtures: `tests/conftest.py`

This file comes with the starter and you do not change it.

`tests/conftest.py`

```python
# Make the project root importable (so `import auth` / `import app` work).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app  # noqa: E402
from auth import UserStore  # noqa: E402


@pytest.fixture
def store():
    """A fresh, empty user store for each test."""
    return UserStore()


@pytest.fixture
def client(store):
    """A Flask test client wired to the same store, so tests can inspect it."""
    app = create_app(store=store, testing=True)
    with app.test_client() as client:
        yield client
```

Why it is written this way:

- The tests live in `tests/`, but `auth.py` and `app.py` are in the project root. The
  `sys.path.insert` line makes `import auth` and `import app` work from the test files.
- `store` builds a new `UserStore` for every test, so a user registered in one test never shows
  up in another.
- `client` asks for `store`, and pytest gives both fixtures the same object within one test.
  That is why an integration test can call `store.exists("bob")` or `len(store)` after a request.
- `testing=True` sets Flask's `TESTING` flag, so errors inside a route reach the test instead of
  being turned into a 500 page.
- `yield` instead of `return` lets pytest close the `with` block after the test is done.

## 5. Unit tests: `tests/test_unit.py`

### Unit 1: a pure function

`tests/test_unit.py`

```python
def test_hash_and_verify_password():
    stored = hash_password("secret123")

    assert "secret123" not in stored            # never store plain text
    assert verify_password("secret123", stored)
    assert not verify_password("wrong-pass1", stored)
```

A round-trip test: hash a password, then check that the right password verifies and a wrong one
does not. The first assert guards against storing the password in plain text.

### Unit 2: many inputs with `parametrize`

`tests/test_unit.py`

```python
@pytest.mark.parametrize(
    "username, password, message",
    [
        ("ab", "secret123", "Username"),          # too short
        ("bad name!", "secret123", "Username"),   # illegal characters
        ("a" * 21, "secret123", "Username"),      # too long (max is 20)
        ("alice", "short1", "at least 8"),        # password too short
        ("alice", "nodigitshere", "digit"),       # no digit
    ],
)
def test_register_rejects_invalid_input(store, username, password, message):
    with pytest.raises(AuthError, match=message):
        store.register(username, password)

    assert len(store) == 0                         # nothing was saved
```

The starter has four rows. The third row, `"a" * 21`, is the one you add in exercise 3.

- Each row breaks exactly one rule. The username rows use a valid password, and the password rows
  use the valid username `alice`, so you know which check raised.
- `match` is searched in the exception message as a regular expression. `"Username"` matches
  *"Username must be 3-20 characters: letters, digits or underscore"*, and `"at least 8"` matches
  the password-length message.
- `assert len(store) == 0` checks that a rejected registration saves nothing.

### Unit 3: state and edge cases

`tests/test_unit.py`

```python
def test_register_rejects_duplicate_username(store):
    store.register("Alice", "secret123")

    with pytest.raises(AuthError, match="already taken"):
        store.register("alice", "another123")

    assert len(store) == 1
    assert store.login("ALICE", "secret123")
```

`UserStore` lowercases every username before it stores or looks it up, so `Alice`, `alice` and
`ALICE` are the same user. The test checks that business rule from both sides: the duplicate is
rejected, and login works with any casing.

## 6. Integration tests: `tests/test_integration.py`

### Integration 1: the happy path

`tests/test_integration.py`

```python
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
```

`data=` sends form fields the way a browser does. A successful registration redirects (302) to
`/login`, and `store.exists("bob")` proves the web layer really reached the backend. With
`follow_redirects=True` the client follows the redirect after login and returns the final page,
whose heading `welcome.html` renders as `Welcome, bob!`. `resp.data` is bytes, hence the `b"..."`.

### Integration 2: the error path

`tests/test_integration.py`

```python
def test_login_with_wrong_password_fails(client):
    client.post("/register", data={"username": "bob", "password": "secret123"})

    resp = client.post("/login", data={"username": "bob", "password": "wrong-pass1"})

    assert resp.status_code == 401
    assert b"Invalid username or password" in resp.data
    with client.session_transaction() as sess:
        assert "user" not in sess                       # not logged in
```

The `/login` route answers a bad password with the form again, a flashed error and status 401.
`session_transaction()` opens the session cookie so you can check that no `user` was stored.

### Integration 3: sessions across requests

`tests/test_integration.py`

```python
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
```

The client keeps cookies between calls, like a browser. So the login in the middle carries over to
the next `GET /welcome`, and `POST /logout` (which calls `session.clear()`) locks you out again.
The starter's version also checks that the first redirect goes to `/login`, one line more than the
handout shows.

## 7. Running the tests

Run these from the project folder:

```bash
pytest                          # run everything
pytest -v                       # one line per test
pytest tests/test_unit.py       # one file
pytest -k duplicate             # tests whose name matches
pytest -x                       # stop at first failure
```

The starter suite gives `9 passed`, as the handout says: 6 test functions, and the parametrized
one counts 4 times.

With the solution's tests the result is `13 passed`, in about 0.2 seconds. That is 8 unit cases
(the parametrized test now has 5 rows, plus one new function) and 5 integration cases (two new
functions). The integration tests stay fast because the test client calls the app in-process,
without a server. The slowest part of the suite is the PBKDF2 hashing (100,000 iterations), not
the HTTP layer.

`pytest -k duplicate` selects only `test_register_rejects_duplicate_username`. The new
`test_register_existing_username_fails` does not have the word in its name.

## 8. Exercises

### 1. Break it on purpose (`MIN_PASSWORD_LENGTH = 4`)

In `auth.py`, change `MIN_PASSWORD_LENGTH = 8` to `MIN_PASSWORD_LENGTH = 4` and run `pytest`.
One test case fails:

```
FAILED tests/test_unit.py::test_register_rejects_invalid_input[alice-short1-at least 8]
Failed: DID NOT RAISE AuthError
```

`"short1"` has 6 characters and a digit, so a limit of 4 accepts it, and `pytest.raises` reports
that nothing was raised. No integration test fails, because they all use valid passwords. They
check that the parts are connected, not that each rule is correct. The unit test row that sits
just below the limit is the only thing guarding this rule.

Set the constant back to 8 afterwards. That is why `auth.py` is not in `solution/`: it ends the
lab unchanged.

### 2. `hash_password` is different every time

Add `test_hash_password_is_salted` to `tests/test_unit.py`:

`tests/test_unit.py`

```python
# 1b ── Salting: same password, different hash every time
def test_hash_password_is_salted():
    first = hash_password("secret123")
    second = hash_password("secret123")

    assert first != second                      # random salt → different output
    assert verify_password("secret123", first)  # ...but both still verify
    assert verify_password("secret123", second)
```

It hashes the same password twice, checks that the two strings differ, and checks that both still
verify. The two differ because every call draws a new random salt and stores it in front of the
digest, in the form `salt$hash`:

`auth.py`

```python
def hash_password(password: str, salt: bytes | None = None) -> str:
    """Return 'salt$hash' (both hex) using PBKDF2-SHA256."""
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return f"{salt.hex()}${digest.hex()}"
```

**Why it matters:** without a salt, two users with the same password would get the same hash.
Anyone reading the store would see who shares a password, and precomputed tables (rainbow tables)
could reverse common passwords. With a per-user salt, an attacker has to brute-force each hash on
its own, and PBKDF2's 100,000 iterations make every guess slow.

### 3. 21-character username

Add this row to the parametrize list of `test_register_rejects_invalid_input` (the full list is in
section 5):

`tests/test_unit.py`

```python
        ("a" * 21, "secret123", "Username"),      # too long (max is 20)
```

The username rule is the regular expression `^[a-z0-9_]{3,20}$`. The existing `"ab"` row tests
the value just below the lower limit, and the new row tests the value just above the upper limit,
so both edges of the valid range are now covered.

### 4. `GET /register`

Add `test_get_register_shows_form` to `tests/test_integration.py`:

`tests/test_integration.py`

```python
# 4 ── GET: the registration form renders
def test_get_register_shows_form(client):
    resp = client.get("/register")

    assert resp.status_code == 200
    assert b"Create an account" in resp.data
```

It checks for status 200 and the heading `Create an account`. This covers the GET branch of the
route and the rendering of `form.html` in register mode, which the starter tests never request
directly. One thing to know: the login page also contains `Create an account` (in its "New here?"
link), so this text alone would not catch the route rendering the wrong form.

### 5. Registering an existing username

Add `test_register_existing_username_fails` to `tests/test_integration.py`:

`tests/test_integration.py`

```python
# 5 ── Error path: duplicate username is rejected over HTTP
def test_register_existing_username_fails(client, store):
    client.post("/register", data={"username": "bob", "password": "secret123"})

    resp = client.post("/register", data={"username": "bob", "password": "another123"})

    assert resp.status_code == 400
    assert b"already taken" in resp.data
    assert len(store) == 1                               # no second account saved
```

It checks for status 400, the text `already taken` in the page, and that the store still holds
only one user. Unit 3 already tests the rule itself. This test checks the wiring around it: the
route catches the `AuthError`, uses the right status code and shows the message to the user.

### 6. Bonus: coverage

`pytest-cov` is not in `requirements.txt`, so install it first:

```bash
pip install pytest-cov
pytest --cov=. --cov-report=term-missing
```

With the solution's tests the report shows (the rows for the test files are left out):

```
Name                        Stmts   Miss  Cover   Missing
---------------------------------------------------------
app.py                         47      5    89%   18-20, 44, 62
auth.py                        44      0   100%
...
TOTAL                         164      5    97%
```

`auth.py` is 100% covered. The untested lines are all in `app.py`:

| Line(s) | Code | Why it is untested |
|---|---|---|
| 18-20 | the `/` index route (redirect to `/welcome` or `/login`) | No test requests `GET /` |
| 44 | `GET /login` rendering the form | Tests only send `POST` to `/login` |
| 62 | `create_app().run(debug=True)` under `__main__` | Runs only with `python app.py`, never under pytest |

Two small integration tests would cover lines 18-20 and 44: a `GET /` test (logged out, it
redirects to `/login`; logged in, to `/welcome`) and a `GET /login` test. Line 62 is normally
excluded from coverage.

High coverage does not prove the rules are right. Exercise 1 shows it: the integration tests run
the password check on every registration, yet none of them notices when its limit changes.

## Files in solution/

| File | Status | What it does |
|---|---|---|
| `tests/test_unit.py` | changed | The starter's three unit tests, plus `test_hash_password_is_salted` (exercise 2) and the 21-character username row (exercise 3) |
| `tests/test_integration.py` | changed | The starter's three integration tests, plus `test_get_register_shows_form` (exercise 4) and `test_register_existing_username_fails` (exercise 5) |

Everything else (`app.py`, `auth.py`, `templates/`, `tests/conftest.py`, `requirements.txt`)
stays as it is in the starter. No file needs deleting, apart from the `__MACOSX/` metadata
folder if unzip created one. To get the finished project, unzip the starter and copy `solution/`
over it:

```bash
unzip starter.zip -d testing-guide
cp -R solution/. testing-guide/
cd testing-guide
pytest                          # 13 passed
```
