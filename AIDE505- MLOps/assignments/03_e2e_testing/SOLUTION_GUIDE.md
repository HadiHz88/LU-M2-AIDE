# End-to-End Testing a Node App with Playwright: solution guide

The lab runs a small registration and login app (Vite, plain JavaScript, no backend), checks it by
hand, then automates those checks with Playwright. You start from `starter.zip` (the teacher's
`node-auth-app`). `solution/` holds the only file that changes: `tests/auth.spec.js`, which keeps
the starter's two tests and adds five more. The app code itself is not touched.

Everything below was measured on a MacBook with Apple silicon, Node v24.14.1, npm 11.11.0 and
Playwright 1.65.0 (Chromium 158). The video `e2e-playwright-demo.mp4` in this lab folder (4 min)
shows `npm run dev`, the checklist by hand, `npx playwright test`, exercise 1 failing and being
reverted, `--ui` mode and the HTML report.

## 1. The project

Unzip `starter.zip`. You get a `node-auth-app/` folder (plus a `__MACOSX/` folder you can ignore).
Two things in the app matter for the tests later, so read `src/main.js` once.

Navigation uses the URL hash, and `render()` is the guard that decides which page you see. The
welcome page is only shown when `currentUser` is set; anything else is sent to `#/login`:

`src/main.js` (starter, unchanged)

```js
function render() {
  const route = location.hash.slice(1);
  if (route === "/register") renderForm("register");
  else if (route === "/welcome" && currentUser) renderWelcome();
  else if (route !== "/login") return go(currentUser ? "/welcome" : "/login");
  else renderForm("login");
  showFlash();
}

window.addEventListener("hashchange", render);
```

Every message (green or red) is a box with `role="alert"`, which is what the tests look for:

```js
  box.setAttribute("role", "alert");
```

Users live in a `Map` inside a `UserStore` in `src/auth.js`. A refresh creates a new, empty store.

## 2. Install Node.js

Install the LTS version (anything from v22.12 works), then check it:

```bash
node -v      # v24.14.1 here
npm -v       # 11.11.0 here
```

## 3. Run the app

```bash
cd node-auth-app
npm install
npm run dev
```

What you should see:

```
$ npm install
added 19 packages, and audited 20 packages
found 0 vulnerabilities

$ npm run dev
  VITE v8.3.8  ready in 100 ms
  ➜  Local:   http://127.0.0.1:5173/
```

Vite prints `127.0.0.1`, but `http://localhost:5173` opens the same server. `npm install` also
creates `package-lock.json`. That file is generated, so it is not in `solution/`.

## 4. Confirm it works

Go through the handout's checklist in the browser. All seven rows behaved as expected:

| # | Do this | You get |
| --- | --- | --- |
| 1 | Register `alice` / `abc` | Red: *Password must be at least 8 characters* |
| 2 | Register `alice` / `secret123` | Green: *Account created for alice. Please log in.*, now on `#/login` |
| 3 | Register `alice` again | Red: *Username already taken* |
| 4 | Log in `alice` / `wrong-pass1` | Red: *Invalid username or password* |
| 5 | Log in `alice` / `secret123` | *Welcome, alice!* on `#/welcome` |
| 6 | *Log out*, then open `http://localhost:5173/#/welcome` | Sent back to `#/login` |
| 7 | Refresh, log in as `alice` | *Invalid username or password*: the users were only in memory |

By the end of the lab every row is an automated test, so you never have to click through this
list again.

## 5. Install Playwright

`npm install` already installed the `@playwright/test` library. You only need the browser:

```
$ npx playwright install chromium
Chrome Headless Shell 158.0.8127.18 (playwright chromium-headless-shell v1254) downloaded
```

`playwright.config.js` is used exactly as given. The part worth remembering is `webServer`:
Playwright runs `npm run dev` itself before the tests and stops it afterwards, and
`reuseExistingServer: true` means it reuses your server if one is already running. `baseURL` is why
the tests can write `page.goto("/#/register")`.

## 6. The tests

The starter's `tests/auth.spec.js` has a helper, a `beforeEach` that registers `alice`, a happy
path and a sad path. Read them before changing anything; the solution keeps all of it.

`tests/auth.spec.js`

```js
// Helper: fill the form on the current page and submit it.
async function submitForm(page, username, password, button) {
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: button }).click();
}
```

The locators find elements the way a user does: by label text and by role plus visible name, never
by CSS class or id. Two details help with the rest of the file:

- A string `name` in `getByRole` matches a substring and ignores case. So
  `getByRole("heading", { name: "Welcome" })` matches *Welcome, alice!*, and `toBeHidden()` on it
  means "no welcome heading of any kind".
- `expect(...)` assertions retry for up to 5 seconds. You never need a `sleep`.

Each test gets a fresh browser tab, so the `Map` starts empty. That is why every test that needs
`alice` registers her first in `beforeEach`.

## 7. Run the tests

```bash
npx playwright test               # headless, prints results
npx playwright test --headed      # watch the browser do it
npx playwright test --ui          # step through each action
npx playwright show-report        # open the HTML report
```

With the starter's two tests:

```
$ npx playwright test
Running 2 tests using 1 worker

  ✓  1 [chromium] › tests/auth.spec.js:19:1 › registered user can log in (523ms)
  ✓  2 [chromium] › tests/auth.spec.js:27:1 › login with invalid credentials shows an error (258ms)

  2 passed (4.8s)
```

The first run took 4.8 s because `webServer` had to start Vite. Later runs take 1.4 s. The line
numbers (`:19:1`, `:27:1`) are from the starter file; they move once you add the new tests.

The other modes are worth a look too. `--headed` opens a real window and you watch it click; with
the final suite it gives `7 passed (8.0s)`, slower because it draws every step. `--ui` lets you
step through each action with a DOM snapshot before and after. `show-report` opens the HTML report
that the `html` reporter writes to `playwright-report/`.

## 8. Exercises

### Exercise 1: Break it on purpose

In `src/auth.js`, make `login()` skip the password check:

```js
async login(username, password) {
  const stored = this.#users.get(UserStore.normalize(username));
  return stored !== undefined; // password check skipped
}
```

Run the suite:

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

**What happened:** with the password check gone, `alice` / `wrong-pass1` logs in. The call log
tells the story. On the first check, the old green box from `beforeEach` was still on screen (wrong
text). Then the app moved to `#/welcome`, which has no alert at all, so for the rest of the 5
seconds the locator found nothing, and the test failed on its first assertion.

**Why only that one:** the happy path logs in with the correct password. The bug turns "user exists
and password matches" into "user exists". For the right password both answers are the same, so the
happy path cannot see the difference. Only a test that sends a wrong password for a user who
exists goes through the removed code. A happy path alone is not enough: every rule needs a test
that tries to break it.

The same holds for the new tests below. With this bug, *login as an unknown user* (exercise 2)
still passes: `bob` is not in the map, `stored` is `undefined`, and `login()` still returns
`false`. The two sad paths test two different branches, and only one of them was broken.

Revert the change. `src/auth.js` is then identical to the starter again (a `diff` against the zip
is empty) and the suite is back to `2 passed`.

### Exercises 2 to 4: the new tests

The solution adds the three exercise tests plus two extras, so all seven checklist rows are
automated (row 2 is the `beforeEach` itself):

| Test | Covers |
| --- | --- |
| registered user can log in | given (checklist row 5) |
| login with invalid credentials shows an error | given (row 4) |
| login as an unknown user shows an error | **exercise 2** |
| after logging out, the welcome page redirects to login | **exercise 4** (row 6) |
| registering an existing username shows an error | extra (row 3) |
| refreshing the page forgets registered users | extra (row 7) |
| registering with a too-short password shows an error | **exercise 3** (row 1) |

First, restructure the file. The tests that need `alice` go inside a `test.describe` together with
the `beforeEach`. The validation test does not need her, so it sits outside and skips that setup:

`tests/auth.spec.js`

```js
// Tests that need a registered user.
test.describe("with alice registered", () => {
  // Every test starts in a fresh browser tab, so the in-memory store is empty.
  // Each test therefore registers its own user first.
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/register");
    await submitForm(page, "alice", "secret123", "Register");
    await expect(page.getByRole("alert")).toHaveText("Account created for alice. Please log in.");
  });
```

The two given tests move inside unchanged (only indented, with the checklist row added to their
comments).

#### Exercise 2: unknown user

```js
  // Exercise 2: a user who never registered gets the same error as a wrong password.
  test("login as an unknown user shows an error", async ({ page }) => {
    await submitForm(page, "bob", "secret123", "Log in");

    await expect(page.getByRole("alert")).toHaveText("Invalid username or password");
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeHidden();
  });
```

`bob` gets exactly the same message as a wrong password. That is on purpose: a different message
("no such user") would let anyone find out which usernames exist. Like the given sad path, the
test checks the message, the URL, and that no welcome page appears.

#### Exercise 3: validation

```js
// Exercise 3 (checklist row 1): validation runs before anything is stored.
test("registering with a too-short password shows an error", async ({ page }) => {
  await page.goto("/#/register");
  await submitForm(page, "alice", "abc", "Register");

  await expect(page.getByRole("alert")).toHaveText("Password must be at least 8 characters");
  await expect(page).toHaveURL(/#\/register$/);

  // Nothing was stored: alice cannot log in.
  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible(); // wait for the re-render
  await submitForm(page, "alice", "abc", "Log in");
  await expect(page.getByRole("alert")).toHaveText("Invalid username or password");
});
```

It checks the red message and that you stay on `#/register`. Then it checks that nothing was
stored: logging in as `alice` / `abc` fails. The heading check before typing is explained in
"A flaky-test bug" below.

#### Exercise 4: logout

```js
  // Exercise 4 (checklist row 6): after logging out, #/welcome sends you back to login.
  test("after logging out, the welcome page redirects to login", async ({ page }) => {
    await submitForm(page, "alice", "secret123", "Log in");
    await expect(page.getByRole("heading", { name: "Welcome, alice!" })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/#\/login$/);

    // Same tab, only the hash changes: no reload, so this tests the app's own guard.
    await page.goto("/#/welcome");
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeHidden();
  });
```

The test logs in, clicks *Log out*, checks you are on `#/login`, then opens `/#/welcome`. Only the
hash changes, so the page does not reload and the in-memory state survives. The redirect therefore
comes from the guard in `render()` (`route === "/welcome" && currentUser`), not from a reload
wiping `currentUser`. That is the behaviour the exercise asks about.

#### Extras: rows 3 and 7

```js
  // Extra (checklist row 3): the same username cannot be registered twice.
  test("registering an existing username shows an error", async ({ page }) => {
    await page.getByRole("link", { name: "Create an account" }).click();
    // The form is re-rendered on "hashchange", a moment after the click. Wait for the
    // new page, or fill() may type into the old form just before it is replaced.
    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
    await submitForm(page, "alice", "secret123", "Register");

    await expect(page.getByRole("alert")).toHaveText("Username already taken");
    await expect(page).toHaveURL(/#\/register$/);
  });

  // Extra (checklist row 7): users live only in memory, so a page refresh wipes them.
  test("refreshing the page forgets registered users", async ({ page }) => {
    await page.reload();
    await submitForm(page, "alice", "secret123", "Log in");

    await expect(page.getByRole("alert")).toHaveText("Invalid username or password");
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeHidden();
  });
});
```

After `beforeEach` you are on `#/login`, so the duplicate test first follows the *Create an
account* link. The refresh test uses `page.reload()`, which is a real reload: a new `UserStore`,
an empty `Map`, and `alice` is gone.

#### The final run

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

### A flaky-test bug (and its fix)

The first version of the row 3 and exercise 3 tests failed:

```
Locator: getByRole('alert')
Expected: "Username already taken"
Error: element(s) not found
```

Cause: both tests click a link (*Create an account*, *Log in*) and then fill the form. The click
changes `location.hash`, and the app re-renders on the `hashchange` event, which fires a moment
after the click. `fill()` found the old form, typed into it, and then the old form was replaced
by an empty new one. The `required` fields stopped the submit, so no message ever appeared.

Fix: wait for the new page before typing, the same way a user looks at the screen first:

```js
    await page.getByRole("link", { name: "Create an account" }).click();
    // The form is re-rendered on "hashchange", a moment after the click. Wait for the
    // new page, or fill() may type into the old form just before it is replaced.
    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
    await submitForm(page, "alice", "secret123", "Register");
```

The given tests never hit this because they start with `page.goto()`, which waits for the page
to load. To check the fix, run every test 10 times with 4 workers in parallel:

```
$ npx playwright test --repeat-each=10 --workers=4
  70 passed (9.6s)
```

### Do the new tests catch bugs? (mutation check)

A test is only useful if it fails when the code is wrong. Break the app one way at a time, run
the full suite, then restore the file:

| Bug introduced | Tests that failed |
| --- | --- |
| A. `login()` skips the password check (exercise 1) | only *login with invalid credentials shows an error* |
| B. *Log out* no longer sets `currentUser = null` (`src/main.js`) | only *after logging out, the welcome page redirects to login* |
| C. `MIN_PASSWORD_LENGTH` lowered from 8 to 3 (`src/auth.js`) | only *registering with a too-short password shows an error* |

Each bug is caught by exactly the test written for that rule, and by no other: `6 passed` every
time. After each restore the suite was back to `7 passed`.

For bug B, the guard sees a `currentUser` that was never cleared, so `/#/welcome` shows the
welcome page instead of redirecting. For bug C, `abc` now passes the length check and hits the
next rule in `validatePassword()` (it has no digit), so the alert shows a different message than
the test expects.

## Files in solution/

| File | Status | What it does |
| --- | --- | --- |
| `tests/auth.spec.js` | changed | The starter's helper and two tests, regrouped under `test.describe("with alice registered")`, plus five new tests: exercises 2, 3 and 4 and checklist rows 3 and 7 |

Nothing has to be deleted from the starter. To get the finished project, unzip `starter.zip`,
copy `solution/tests/auth.spec.js` over `node-auth-app/tests/auth.spec.js`, then run:

```bash
cd node-auth-app
npm install
npx playwright install chromium
npx playwright test               # 7 passed
```
