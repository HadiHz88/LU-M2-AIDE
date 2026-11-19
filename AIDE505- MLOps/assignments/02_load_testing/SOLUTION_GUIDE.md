# Load Testing the Auth App with k6 and Grafana Cloud: solution guide

This lab load-tests the Flask auth app from lab 01 with k6: a steady 50 requests per second first,
read in Grafana Cloud, then more and more traffic until the app breaks. You start from `starter.zip`
(the lab 01 app, with `waitress` already in `requirements.txt` and the complete
`loadtests/load_test.js`). `solution/` holds only the three k6 scripts written for the exercises.
Sections 1 to 7 need no new code from you.

All numbers below come from real runs on one machine: Apple M1 Pro (10 cores), k6 v2.3.0,
Python 3.12, waitress 3. k6 and the app ran on the same laptop, so they compete for CPU. Your
absolute numbers will differ, and the limits would be higher with the load generator on another
machine. The Grafana Cloud part needs your own account. The local end-of-test summary
(`k6 run --summary-mode=full`) reports the same metrics as the cloud dashboard, so the answers
below are read from it.

## 1. What is load testing?

Nothing to do here. Keep one idea in mind for the whole lab: you judge latency by its p95 (95% of
requests were faster than this), not by the average, because the average hides slow outliers.

## 2. The setup

Two terminals on your machine: waitress serves the app on `127.0.0.1:8000`, k6 sends the load to
it. Grafana Cloud only receives the results. The app never needs to be online.

## 3. Create a Grafana Cloud account

Follow the handout: create a free account, pick a stack name, open Testing & synthetics,
Performance once so the k6 app initialises, then copy your personal token from Settings, Access.
Treat the token like a password: never put it in a file you commit.

The free tier gives 500 VUh per month and each cloud run costs at least 1 VUh. Plain `k6 run`
(no cloud) costs nothing, so use it for the exercises in section 8.

## 4. Install what you need locally

From the project folder, with the venv from lab 01 activated:

```bash
pip install -r requirements.txt      # waitress is already listed in the starter
brew install k6                      # macOS; see the handout for Windows and Linux
k6 version                           # these runs used k6 v2.3.0
k6 cloud login --token <YOUR_TOKEN> --stack <YOUR_STACK_SLUG>   # once per machine
```

## 5. Write the load test

### 5.1 Start the app with waitress

In terminal 1:

```bash
waitress-serve --listen=127.0.0.1:8000 --threads=8 --call app:create_app
```

`--call app:create_app` tells waitress to call the factory and serve the app it returns. That
works because `create_app()` in `app.py` is already a factory. Use waitress, not `python app.py`:
Flask's built-in server is for development and would distort the results.

Remember that the user store is in memory. Restarting waitress wipes every registered user, which
is why the test script registers its own user in `setup()`.

### 5.2 Plan the traffic

50 requests per second, split the way real visitors behave: 40/s open the login page
(`GET /login`, cheap) and 10/s submit it (`POST /login`, expensive because of password hashing).

### 5.3 Build the script: `loadtests/load_test.js`

The complete file is already in the starter. It matches steps A to D of the handout, with
`DURATION = "2m"` pulled into a constant. Each scenario also has a second check that the handout
snippets leave out.

`loadtests/load_test.js` (from the starter):

```javascript
// Scenario 1: a visitor opens the login page (cheap request).
export function browse() {
  const res = http.get(`${BASE_URL}/login`, { tags: { name: "GET /login" } });
  check(res, {
    "login page 200": (r) => r.status === 200,
    "login form shown": (r) => r.body.includes("Log in"),
  });
}

// Scenario 2: a user submits the login form (expensive: password hashing).
// redirects: 0 keeps it to exactly one request; success is a 302 to /welcome.
export function login() {
  const res = http.post(`${BASE_URL}/login`, USER, {
    redirects: 0,
    tags: { name: "POST /login" },
  });
  check(res, {
    "login succeeded": (r) => r.status === 302,
    "redirects to welcome": (r) => (r.headers["Location"] || "").endsWith("/welcome"),
  });
}
```

Why it is written this way:

- `constant-arrival-rate` starts a fixed number of iterations per second, however slow the server
  is. If responses slow down, k6 adds VUs instead of slowing down with the server.
- `redirects: 0` keeps each iteration to one request, so iterations per second equal requests per
  second. A successful login is a `302` whose `Location` ends in `/welcome`.
- The `tags: { name: ... }` give each request a stable name, so the HTTP tab (and the summary)
  shows one row per request type.
- The thresholds make the run pass or fail. If any is crossed, k6 exits with an error, like a
  failing pytest.

### 5.4 Run it

In terminal 2, a quick local run first. After about 10 seconds you should see requests flowing:

```text
running (0m10.0s), 001/030 VUs, 499 complete and 0 interrupted iterations
browse   [   8% ] 001/020 VUs  0m10.0s/2m0s  40.00 iters/s
login    [   8% ] 000/010 VUs  0m10.0s/2m0s  10.00 iters/s
```

Press Ctrl+C, then run the real test. Either let it finish locally, or stream it to Grafana Cloud:

```bash
k6 run --summary-mode=full loadtests/load_test.js           # local, per-scenario summary
k6 cloud run --local-execution loadtests/load_test.js       # same run, results in Grafana Cloud
```

`--summary-mode=full` adds a block per scenario to the summary. If you also want the raw
per-request data (for per-second rates or your own percentiles), add `--out csv=results/<name>.csv`
and keep `results/` out of git.

The summary ends with a `THRESHOLDS` block: one line per threshold, a tick or a cross, and the
actual value. On the 2-minute run with 8 threads all six had a tick, for example
`✓ 'p(95)<500' p(95)=17.78ms`. The full values are in question 3 below.

## 6. Read the results in Grafana Cloud

In the cloud run, the Performance Overview should show a flat request rate around 50, a flat low
response time, and a VU count that does not climb. Cloud Insights should be empty or green. The
Thresholds, Checks and HTTP tabs show the same numbers as the local summary: the `THRESHOLDS`
block, the check lines, and the per-scenario `HTTP` blocks.

Per-request results of the 2-minute run (8 waitress threads, fresh server):

| Request | Count | avg | p95 | p99 | max | Errors |
|---|---|---|---|---|---|---|
| `GET /login` | 4800 | 0.97 ms | 1.73 ms | 4.1 ms | 39.5 ms | 0 |
| `POST /login` | 1201 | 15.4 ms | 20.97 ms | 23.8 ms | 48.6 ms | 0 |

**1. Did we hold 50 req/s for the full 2 minutes?**
Yes. k6 ran 6001 iterations (4800 + 1201) at 50.0 per second, and every full second stayed
between 49 and 52 requests. `http_reqs` shows 6002 because it also counts the one `POST /register`
from `setup()`. `dropped_iterations` was 0, so k6 started every planned iteration on time.

**2. Which request is slower, by how much, and why?**
`POST /login` is about 16 times slower on average (15.4 ms against 0.97 ms) and about 12 times
slower at p95 (21 ms against 1.7 ms). `GET /login` only renders a template. `POST /login` calls
`verify_password()`, which runs `hash_password()`: PBKDF2-HMAC-SHA256 with 100,000 iterations.
That is about 11 ms of pure CPU work per login. The slowness is on purpose: it is what makes
stolen hashes expensive to brute-force.

**3. Did any threshold fail?**
No, all of them passed:

| Threshold | Actual |
|---|---|
| `http_req_failed rate<0.01` | 0.00% |
| `http_req_duration p(95)<500` | 17.78 ms |
| `http_req_duration{scenario:login} p(95)<800` | 20.97 ms |
| `http_reqs rate>=45` | 50.0/s |
| `checks rate>0.99` | 100% |
| `dropped_iterations count<10` | 0 |

For users, this means every request succeeded and 95% of them got an answer in under 18 ms.

**4. How many VUs did k6 actually need?**
About 1 busy VU (the sampled `vus` metric peaked at 1), even though 30 were pre-allocated
(`vus_max = 30`). This matches the rule of thumb, VUs ≈ rate × response time:
40 × 0.001 s + 10 × 0.015 s ≈ 0.19 busy VUs on average. A VU count that climbs during a run is an
early sign that responses are slowing down.

## 7. Updated code

Nothing to do: the starter already contains both changes from the handout's table
(`waitress>=3.0` in `requirements.txt` and the complete `loadtests/load_test.js`). The app itself
is unchanged.

## 8. Exercises

### Exercise 1: stress test

Make the login rate configurable instead of editing `load_test.js` for every run.
`loadtests/stress_test.js` is the same traffic, with the rates and the duration read from
environment variables:

`loadtests/stress_test.js`:

```javascript
const DURATION = __ENV.DURATION || "1m";
const BROWSE_RATE = Number(__ENV.BROWSE_RATE || 40);
const LOGIN_RATE = Number(__ENV.LOGIN_RATE || 50);
```

```javascript
    http_reqs: [`rate>=${0.9 * (BROWSE_RATE + LOGIN_RATE)}`],
```

The other thresholds are the same as in `load_test.js`. Only the `http_reqs` floor follows the
target (90% of it instead of a fixed 45), so at 400 logins/s the summary shows `'rate>=396'`. The
`login` scenario also gets `maxVUs: 200` instead of 100, so k6 can keep up when the server slows
down.

```bash
LOGIN_RATE=50  DURATION=30s k6 run loadtests/stress_test.js
LOGIN_RATE=100 DURATION=30s k6 run loadtests/stress_test.js
LOGIN_RATE=250 DURATION=1m  k6 run loadtests/stress_test.js    # and so on
```

Both rates the handout asks for pass easily, so keep raising the rate to find the break. `browse`
stays at 40/s in every run. Runs lasted 30 s, or 1 minute near the limit (marked below), with 8
threads:

| login/s | total req/s | GET p95 | POST p95 | dropped iters | Failed thresholds |
|---|---|---|---|---|---|
| 50 | 90 | 1.7 ms | 13.4 ms | 0 | none |
| 100 | 140 | 1.0 ms | 12.9 ms | 0 | none |
| 200 (1 min) | 240 | 0.8 ms | 13.9 ms | 0 | none |
| 250 (1 min) | 290 | 1.0 ms | 19.8 ms | 13 | `dropped_iterations` |
| 300 (1 min) | 339 | 16 ms | 45 ms | 33 | `dropped_iterations` |
| 350 | 364 | 319 ms | 311 ms | 668 | `dropped_iterations`, `http_reqs` rate |
| 400 | 392 | 228 ms | 253 ms | 1192 | `dropped_iterations`, `http_reqs` rate |

When a threshold fails, k6 says so at the end of the output:

```text
level=error msg="thresholds on metrics 'dropped_iterations, http_reqs' have been crossed"
```

**Thresholds start failing at about 250 logins/s (about 290 req/s in total).**

- **First to fail:** `dropped_iterations`. Latency is still fine at that point, but small hiccups
  push the work beyond the 10 pre-allocated VUs, and k6 drops an iteration each time it has to
  create a new VU mid-test.
- **Collapse at 350/s and above:** requests queue, p95 goes from about 15 ms to about 300 ms
  (20 times), and k6 needs 200+ VUs. Even the cheap `GET /login` becomes as slow as a login,
  because it waits in the same queue for a free server thread.
- **Why `http_reqs` reports about half the target rate** (for example 198/s instead of 400/s):
  the rate is averaged over the whole run, including the 30 s `gracefulStop` while queued requests
  drain. A 30 s test that overruns lasts 60 s, which halves the reported rate.

Results near the limit are noisy. The same 250/s rate run for only 30 s dropped 67 iterations with
a login p95 of 79 ms, against 13 dropped and 19.8 ms over 1 minute. Treat the numbers as the shape
of the behaviour, not as exact capacity.

### Exercise 2: tune the server

Restart waitress with a different thread count, then repeat exercise 1:

```bash
waitress-serve --listen=127.0.0.1:8000 --threads=2 --call app:create_app
waitress-serve --listen=127.0.0.1:8000 --threads=16 --call app:create_app
```

`POST /login` p95 for each thread count. "pass" means all thresholds pass, "dropped only" means
only `dropped_iterations` fails while latency is still fine, "fail" means the server is overloaded:

| login/s | 2 threads | 8 threads | 16 threads |
|---|---|---|---|
| 50 | pass, 11.8 ms | pass, 13.4 ms | not run |
| 100 | pass, 16.9 ms | pass, 12.9 ms | not run |
| 150 | fail: **583 ms**, **1.95% errors**, 214 dropped | not run | not run |
| 200 | fail: 644 ms, **26% errors** | pass, 13.9 ms | dropped only: 16 ms, 11 dropped |
| 250 | not run | dropped only: 19.8 ms, 13 dropped | dropped only: 19.8 ms, 25 dropped |
| 300 | not run | dropped only: 45 ms, 33 dropped | dropped only: 20 ms, 11 dropped |
| 400 | not run | fail: 253 ms, 1192 dropped | fail: 188 ms, 98 dropped |

What changes:

- **2 threads:** only 2 logins can hash at the same time. Capacity is about 2 / 11.5 ms ≈ 170
  logins/s minus overhead, so it breaks at **150/s**.
  - Requests wait in the queue (p95 about 580 ms). The login threshold (`p(95)<800`) still
    passes, but the overall `p(95)<500`, `checks`, `http_req_failed`, `dropped_iterations` and
    `http_reqs` all fail.
  - k6 opens more and more connections to keep the rate. Past waitress's default
    `connection_limit` of 100, new connections are reset. They show as status `0` (1.95%, then 26%
    failed requests), with warnings like
    `Post "http://127.0.0.1:8000/login": dial tcp 127.0.0.1:8000: connect: connection reset by peer`.
- **8 to 16 threads:** almost the same ceiling (about 300 logins/s). The work is CPU-bound.
  `hashlib.pbkdf2_hmac` releases the GIL, so threads do hash in parallel, but only up to the 10
  cores, which k6 also uses. Threads beyond the core count just queue on the CPU. 16 threads only
  degrade more gently under overload (98 against 1192 dropped at 400/s).
- **Conclusion:** more threads help until you run out of cores. After that you need more processes
  or machines (scale out), not more threads.

### Exercise 3: security against speed

Change the iteration count in `auth.py` temporarily:

`auth.py` (starter, line to change):

```python
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
```

Set it to `10_000`, restart waitress (the old process still runs the old code, and the restart
also gives `setup()` a fresh user hashed with the new count), rerun exercise 1 with 8 threads, then
**put 100_000 back**.

| login/s | 100k: POST avg / p95 | 10k: POST avg / p95 |
|---|---|---|
| 50 | 12.1 ms / 13.4 ms | **3.3 ms / 6.2 ms** |
| 400 | 167 ms / 253 ms, 1192 dropped | 15.9 ms / 103 ms, 188 dropped |
| 800 | not run | 30 ms / 204 ms, 3058 dropped, fail |

- **Faster?** Yes, about 4 times per login (12.1 ms to 3.3 ms on average). It is not 10 times,
  because the HTTP, Flask and session work stays the same. Capacity also improves, but the test
  still fails at 400/s, because the bottleneck moves to Python request handling and to k6 sharing
  the CPU.
- **Why it is a bad trade in production:** the iteration count is the cost an attacker pays for
  every password guess if the user table leaks. 10 times fewer iterations means 10 times more
  guesses per second on a GPU, so weak passwords fall 10 times faster. The cost hits attackers
  billions of times but users only once per login. OWASP even recommends 600,000 iterations for
  PBKDF2-HMAC-SHA256, so 100k is already on the low side.
- **The right fix for login capacity** is to scale out (more workers or machines), add rate
  limiting on `/login`, or move hashing to a dedicated worker. Weakening the hash is not.

### Exercise 4: ramp up

`loadtests/ramp_test.js` keeps only the `login` scenario and swaps its executor for
`ramping-arrival-rate`: 1m30s ramp up, 30 s hold at the peak, 1 minute ramp down. The peak comes
from an environment variable so you can push it past capacity later.

`loadtests/ramp_test.js`:

```javascript
const PEAK = Number(__ENV.PEAK || 50);
```

```javascript
  scenarios: {
    login: {
      executor: "ramping-arrival-rate",
      exec: "login",
      startRate: 0,
      timeUnit: "1s",
      preAllocatedVUs: 10,
      maxVUs: 200,
      stages: [
        { target: PEAK, duration: "1m30s" },   // ramp up
        { target: PEAK, duration: "30s" },     // hold the peak
        { target: 0, duration: "1m" },         // ramp down
      ],
    },
  },
```

The thresholds keep only `http_req_failed`, the login p95 and `checks`. A fixed `http_reqs` floor
makes no sense when the rate changes on purpose.

```bash
k6 run loadtests/ramp_test.js
PEAK=400 k6 run loadtests/ramp_test.js
```

The end-of-test summary only gives totals. To see the curve, look at the response time graph in
Grafana Cloud, or export with `--out csv=...` and group the requests into 10 s windows, as below.

With the default peak of 50/s, all thresholds passed (5250 logins, p95 18.6 ms, at most 3 VUs).
`POST /login` latency per 10 s window:

| Peak 50/s | rate | p50 | p95 |
|---|---|---|---|
| ramping up (30 to 40 s) | 20/s | 13.3 ms | 14.6 ms |
| at peak (100 to 120 s) | 50/s | 11.5 ms | 13.6 ms |
| ramping down (160 to 170 s) | 11/s | 13.3 ms | 18.9 ms |

**At 50/s the curve never bends.** p50 stays flat at 11 to 14 ms for the whole 3 minutes, because
50 logins/s uses only about 0.6 of one core. The p95 blips (40 to 55 ms) are short and appear at
random times, not linked to the load.

To actually see the bend, run the same ramp with `PEAK=400`:

| window | rate | p50 | p95 |
|---|---|---|---|
| 40 to 50 s | 203/s | 12 ms | 17 ms |
| 60 to 70 s | 292/s | 14 ms | 22 ms |
| **70 to 80 s** | **319/s** | 45 ms | **254 ms** (the bend) |
| 100 to 110 s | 373/s | 227 ms | 325 ms |
| 150 to 170 s (ramping down) | 107 to 157/s | 16 ms | **1,025 to 1,119 ms** |

- **Where it bends:** at **about 300 to 320 req/s**, the same knee as exercise 1. Below it,
  latency is flat. Above it, requests queue and p95 jumps 10 times.
- **What failed:** `checks` (97.19%) and `http_req_failed` (2.80%). The login p95 over the whole
  run (303.82 ms) still passed its 800 ms threshold.
  - 1154 failed logins (2.8%): 1021 connection resets and 128 that hit k6's 60 s request timeout.
  - 800 dropped iterations, and the 200-VU cap was reached.
- **Recovery lags behind:** p95 stays above 1 s for about 20 s after the load is already falling,
  while the backlog of stuck connections clears.

### Exercise 5: wrong-password traffic

`loadtests/wrong_password_test.js` is `load_test.js` plus a third scenario, `bad_login`
(`constant-arrival-rate`, `rate: 5`, `exec: "badLogin"`), that sends a wrong password for the
test user:

`loadtests/wrong_password_test.js`:

```javascript
// Scenario 3: a wrong password. The app answers 401, which is the correct behaviour.
// By default k6 marks every 4xx/5xx as failed in http_req_failed; responseCallback
// tells k6 that 401 is the expected answer for this request.
// Only set the key when wanted: an explicit `responseCallback: undefined` (or null)
// disables failure tracking for the request altogether.
export function badLogin() {
  const params = { redirects: 0, tags: { name: "POST /login (bad password)" } };
  if (EXPECT_401) params.responseCallback = http.expectedStatuses(401);
  const res = http.post(`${BASE_URL}/login`, BAD_USER, params);
  check(res, {
    "bad login rejected with 401": (r) => r.status === 401,
    "error message shown": (r) => r.body.includes("Invalid username or password"),
  });
}
```

The bad login uses the existing `loadtester` user, so the app still runs a full PBKDF2 hash before
it says no: a wrong password costs as much as a right one. The `http_reqs` threshold rises to
`rate>=50`, since the target is now 55 req/s. `EXPECT_401=1` switches the fix on, so you can run
the script both ways (these runs used `DURATION=1m`):

```bash
DURATION=1m k6 run loadtests/wrong_password_test.js                # naive: 401s count as failures
DURATION=1m EXPECT_401=1 k6 run loadtests/wrong_password_test.js   # fixed: 401 is expected
```

| Run | `http_req_failed` | Result |
|---|---|---|
| naive | **9.14%** (302 of 3303) | `rate<0.01` crossed, k6 exit code 99 |
| `EXPECT_401=1` | 0.03% (1 of 3304) | all thresholds pass |

**Yes, `http_req_failed` complains.** By default k6 counts every 4xx/5xx response as failed, and 5
of the 55 req/s are 401s (about 9%). In the naive run all 301 bad logins counted as failed. The
checks are still 100% green, because the app behaves correctly. Only the metric's definition of
"failed" is wrong for this request.

- **Fix:** mark 401 as the expected status for that one request:
  `responseCallback: http.expectedStatuses(401)`. Setting it globally with
  `http.setResponseCallback(...)` would be worse: a real 401 on the good login would then be
  hidden.
- **Gotcha:** writing `responseCallback: undefined` does not restore the default. It turns failure
  tracking off completely for that request, so a first naive version showed 0.03% too. That is why
  the script only adds the key when `EXPECT_401=1`.
- **Where the 0.03% comes from:** `setup()`'s `POST /register` returns 400 when the test user
  already exists from an earlier run against the same server, and that 400 counts as failed too.
  It is harmless under a 1% threshold, but `setup()` could pass
  `responseCallback: http.expectedStatuses(302, 400)` to be exact.

## Files in solution/

| File | Status | What it does |
|---|---|---|
| `loadtests/stress_test.js` | new | Exercises 1 to 3: the `load_test.js` traffic with `LOGIN_RATE`, `BROWSE_RATE` and `DURATION` from env vars, and a rate floor that follows the target |
| `loadtests/ramp_test.js` | new | Exercise 4: `ramping-arrival-rate` from 0 to `PEAK` (default 50) and back over 3 minutes |
| `loadtests/wrong_password_test.js` | new | Exercise 5: a third scenario with bad credentials at 5/s, `EXPECT_401=1` marks 401 as expected |

No starter file changes and none needs deleting. `loadtests/load_test.js`, `requirements.txt` and
the app come from the starter as they are. The `auth.py` edit in exercise 3 is temporary and must
be reverted.

To get the finished project, unzip the starter and copy `solution/` over it:

```bash
unzip starter.zip                                # creates testing-guide/
cp solution/loadtests/*.js testing-guide/loadtests/
```
