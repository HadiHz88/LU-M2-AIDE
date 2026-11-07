# Answers: Testing a Python Web App with pytest

## Setup (section 2)

**Try it: register with password `abc`.**
The page shows *"Password must be at least 8 characters"*. It comes from
`validate_password()` in `auth.py`, which `UserStore.register()` calls after the username
passes `validate_username()`. The route catches the `AuthError`, flashes the message and
returns status 400.

## Running the tests (section 7)

The original suite gives `9 passed`, as the guide says. With the new tests below it gives
`13 passed`.

## Exercises (section 8)

### 1. Break it on purpose (`MIN_PASSWORD_LENGTH = 4`)

One test fails:

```
FAILED tests/test_unit.py::test_register_rejects_invalid_input[alice-short1-at least 8]
Failed: DID NOT RAISE AuthError
```

`"short1"` has 6 characters and a digit, so a limit of 4 accepts it and
`pytest.raises` reports that nothing was raised. No integration test fails, because they
all use valid passwords. The unit test is the one that guards this rule. The constant was
set back to 8 afterwards.

### 2. `hash_password` is different every time

Added `test_hash_password_is_salted` in `tests/test_unit.py`. It hashes the same
password twice, checks that the two strings differ, and checks that both still verify.

**Why it matters:** each call uses a new random salt (`os.urandom(16)`). Without a salt,
two users with the same password would get the same hash. Anyone reading the store would
see who shares a password, and precomputed tables (rainbow tables) could reverse common
passwords. With a per-user salt, an attacker has to brute-force each hash on its own,
and PBKDF2's 100,000 iterations make every guess slow.

### 3. 21-character username

Added the row `("a" * 21, "secret123", "Username")` to the parametrize list. It checks the
upper limit of `^[a-z0-9_]{3,20}$`. The existing `"ab"` row covers the lower limit.

### 4. `GET /register`

Added `test_get_register_shows_form` in `tests/test_integration.py`. It checks for
status 200 and the text `Create an account`.

### 5. Registering an existing username

Added `test_register_existing_username_fails`. It checks for status 400, the text
`already taken` in the page, and that the store still holds only one user.

### 6. Bonus: coverage

```
pytest --cov=. --cov-report=term-missing

Name                        Stmts   Miss  Cover   Missing
---------------------------------------------------------
app.py                         47      5    89%   18-20, 44, 62
auth.py                        44      0   100%
...
TOTAL                         164      5    97%
```

Untested lines in `app.py`:

| Line(s) | Code | Why it is untested |
|---|---|---|
| 18–20 | the `/` index route (redirect to `/welcome` or `/login`) | No test requests `GET /` |
| 44 | `GET /login` rendering the form | Tests only send `POST` to `/login` |
| 62 | `create_app().run(debug=True)` under `__main__` | Runs only with `python app.py`, never under pytest |

`auth.py` is 100% covered. Two small tests would cover lines 18–20 and 44: a `GET /`
test (logged out → `/login`, logged in → `/welcome`) and a `GET /login` test. Line 62 is
normally excluded from coverage.
