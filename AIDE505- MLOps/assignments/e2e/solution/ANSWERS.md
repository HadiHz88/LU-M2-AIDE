# Answers: End-to-End Testing a Node App with Playwright

Measured on a MacBook with Apple silicon, Node v24.14.1, npm 11.11.0, Playwright 1.65.0
(Chromium 158). The app code (`index.html`, `src/`, `playwright.config.js`, `package.json`) is
**unchanged** from the handout. Only `tests/auth.spec.js` changed, plus `package-lock.json`
created by `npm install`.

## How to run

```bash
npm install
npx playwright install chromium
npx playwright test               # 7 passed
npx playwright show-report
```

## 3. Run the app

```
$ npm install
added 19 packages, and audited 20 packages
found 0 vulnerabilities

$ npm run dev
  VITE v8.3.8  ready in 100 ms
  ➜  Local:   http://127.0.0.1:5173/
```

Vite prints `127.0.0.1`, but `http://localhost:5173` opens the same server.

## 4. Confirm it works (by hand)

Done in the browser, and shown in the video:

| # | Did | Got | OK |
| --- | --- | --- | --- |
| 1 | Register `alice` / `abc` | Red: *Password must be at least 8 characters* | ✓ |
| 2 | Register `alice` / `secret123` | Green: *Account created for alice. Please log in.*, now on `#/login` | ✓ |
| 3 | Register `alice` again | Red: *Username already taken* | ✓ |
| 4 | Log in `alice` / `wrong-pass1` | Red: *Invalid username or password* | ✓ |
| 5 | Log in `alice` / `secret123` | *Welcome, alice!* on `#/welcome` | ✓ |
| 6 | *Log out*, then open `http://localhost:5173/#/welcome` | Sent back to `#/login` | ✓ |
| 7 | Refresh, log in as `alice` | *Invalid username or password*: the users were only in memory | ✓ |

Every row is now also an automated test (see below), so this checklist never has to be done by
hand again.

## 5–7. Playwright and the two given tests

```
$ npx playwright install chromium
Chrome Headless Shell 158.0.8127.18 (playwright chromium-headless-shell v1254) downloaded

$ npx playwright test
Running 2 tests using 1 worker

  ✓  1 [chromium] › tests/auth.spec.js:19:1 › registered user can log in (523ms)
  ✓  2 [chromium] › tests/auth.spec.js:27:1 › login with invalid credentials shows an error (258ms)

  2 passed (4.8s)
```

The first run took 4.8 s because `webServer` had to start Vite. Later runs take 1.4 s. I also
ran `--headed` (a real browser window opens and you watch it click; `7 passed (8.0s)` with
the final suite, slower because it draws every step), `--ui` (step through each action with a
DOM snapshot before and after) and the HTML report. The video shows `--ui` and the report.

## 8. Exercises

### Exercise 1: Break it on purpose

In `src/auth.js`:

```js
async login(username, password) {
  const stored = this.#users.get(UserStore.normalize(username));
  return stored !== undefined; // password check skipped
}
```

```
  ✓  1 [chromium] › tests/auth.spec.js:19:1 › registered user can log in (347ms)
  ✘  2 [chromium] › tests/auth.spec.js:27:1 › login with invalid credentials shows an error (5.3s)

    Error: expect(locator).toHaveText(expected) failed

    Locator: getByRole('alert')
    Expected: "Invalid username or password"
    Timeout: 5000ms
    Error: element(s) not found

    Call log:
      - waiting for getByRole('alert')
        - locator resolved to <div role="alert" class="flash success">Account created for alice. Please log in.</div>
        - unexpected value "Account created for alice. Please log in."

    > 30 |   await expect(page.getByRole("alert")).toHaveText("Invalid username or password");

  1 failed
  1 passed (6.5s)
```

**Which test fails:** only the sad path, *login with invalid credentials shows an error*.

**What happened:** with the password check gone, `alice` / `wrong-pass1` **logs in**. The call log
tells the story. On the first check the old green box from `beforeEach` was still on screen
(wrong text). Then the app went to `#/welcome`, which has no alert at all, so for the rest of
the 5 seconds the locator found nothing, and the test failed on its first assertion.

**Why only that one:** the happy path logs in with the **correct** password. The bug turns
"user exists and password matches" into "user exists". For the right password, both
answers are the same, so the happy path cannot see the difference. Only a test that sends a
**wrong password for a user who exists** goes through the code that was removed. That is why a
happy path alone is not enough: every rule needs a test that tries to break it.

The same applies to the new tests. With this bug, *login as an unknown user* (exercise 2) **still
passes**: `bob` is not in the map, `stored` is `undefined`, and `login()` still returns `false`.
The two sad paths test two different branches, and only one of them was broken.

After reverting, `src/auth.js` is identical to the handout again (`diff` against the zip is empty)
and the suite is back to `2 passed`.

### Exercises 2–4, plus the rest of the checklist

New `tests/auth.spec.js`. The tests that need `alice` are grouped in a `test.describe` with the
`beforeEach`. The validation test does not need her, so it sits outside and skips that setup.

| Test | Covers |
| --- | --- |
| registered user can log in | given (checklist row 5) |
| login with invalid credentials shows an error | given (row 4) |
| login as an unknown user shows an error | **exercise 2** |
| after logging out, the welcome page redirects to login | **exercise 4** (row 6) |
| registering an existing username shows an error | extra (row 3) |
| refreshing the page forgets registered users | extra (row 7) |
| registering with a too-short password shows an error | **exercise 3** (row 1) |

Row 2 is the `beforeEach` itself, so all 7 rows of the checklist are now automated.

```
$ npx playwright test
Running 7 tests using 1 worker

  ✓  1 › with alice registered › registered user can log in (306ms)
  ✓  2 › with alice registered › login with invalid credentials shows an error (258ms)
  ✓  3 › with alice registered › login as an unknown user shows an error (234ms)
  ✓  4 › with alice registered › after logging out, the welcome page redirects to login (288ms)
  ✓  5 › with alice registered › registering an existing username shows an error (297ms)
  ✓  6 › with alice registered › refreshing the page forgets registered users (316ms)
  ✓  7 › registering with a too-short password shows an error (262ms)

  7 passed (2.8s)
```

Notes on each:

- **Exercise 2 (unknown user):** `bob` gets exactly the same message as a wrong password. That is
  on purpose: a different message ("no such user") would let anyone find out which usernames
  exist. The test checks the message, the URL and that no welcome page appears.
- **Exercise 3 (too-short password):** checks the red message and that we stay on `#/register`.
  It then checks that **nothing was stored**: logging in as `alice` / `abc` fails.
- **Exercise 4 (logout):** logs in, clicks *Log out*, checks we are on `#/login`, then
  `page.goto("/#/welcome")`. Only the hash changes, so the page does **not** reload and the
  in-memory state survives. The redirect therefore comes from the app's own guard in `render()`,
  not from a reload wiping `currentUser`. That is the behaviour the exercise asks about.

### A real flaky-test bug I hit (and fixed)

My first version of the row 3 and exercise 3 tests failed:

```
Locator: getByRole('alert')
Expected: "Username already taken"
Error: element(s) not found
```

Cause: both tests click a link (*Create an account*, *Log in*) and then fill the form. The click
changes `location.hash`, and the app re-renders on the `hashchange` event, which fires a moment
**after** the click. `fill()` found the **old** form, typed into it, and then the old form was
replaced by an empty new one. The `required` fields stopped the submit, so no message ever
appeared.

Fix: wait for the new page before typing, the same way a user would look at the screen first:

```js
await page.getByRole("link", { name: "Create an account" }).click();
await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
await submitForm(page, "alice", "secret123", "Register");
```

The given tests never hit this because they start with `page.goto()`, which waits for the
page to load. To check the fix, I ran every test 10 times with 4 workers in parallel:

```
$ npx playwright test --repeat-each=10 --workers=4
  70 passed (9.6s)
```

### Do the new tests catch bugs? (mutation check)

A test is only useful if it fails when the code is wrong. I broke the app three ways, one at a
time, and ran the full suite each time:

| Bug introduced | Tests that failed |
| --- | --- |
| A. `login()` skips the password check (exercise 1) | only *login with invalid credentials shows an error* |
| B. *Log out* no longer sets `currentUser = null` | only *after logging out, the welcome page redirects to login* |
| C. `MIN_PASSWORD_LENGTH` lowered from 8 to 3 | only *registering with a too-short password shows an error* |

Each bug is caught by exactly the test written for that rule, and by no other, with
`6 passed` every time. After each run, the file was restored and the suite was back to `7 passed`.

## What is in the submission

- `node-auth-app/`: the project with the new `tests/auth.spec.js`, plus `package-lock.json`.
- `node-auth-app/playwright-report/`: the HTML report of the final `7 passed` run. Open
  `index.html` in a browser.
- `ANSWERS.md`: this file.
- The video (`e2e-playwright-demo.mp4`, 4 min): `npm run dev`, the 7-row checklist by hand,
  `npx playwright test`, exercise 1 failing and being reverted, `--ui` mode, and the HTML report.
