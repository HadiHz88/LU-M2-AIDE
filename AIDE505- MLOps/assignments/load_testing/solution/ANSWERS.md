# Answers: Load Testing the Auth App with k6

All numbers below come from real runs on one machine: Apple M1 Pro (10 cores), k6 v2.3.0,
Python 3.12, waitress 3. k6 and the app ran on the **same** laptop, so they compete for CPU.
The absolute limits would be higher with the load generator on another machine.

The Grafana Cloud part (account, token, `k6 cloud run --local-execution`) has to be done
with your own account. The local end-of-test summary (`k6 run --summary-mode=full`) reports
the same metrics the cloud dashboard shows, so the answers below are taken from it.

## Files

| File | Purpose |
|---|---|
| `loadtests/load_test.js` | The provided script, unchanged (sections 5–6) |
| `loadtests/stress_test.js` | Exercises 1–3: `LOGIN_RATE` and `DURATION` come from env vars |
| `loadtests/ramp_test.js` | Exercise 4: `ramping-arrival-rate` 0 → `PEAK` (default 50) → 0 over 3 min |
| `loadtests/wrong_password_test.js` | Exercise 5: third scenario with bad credentials at 5/s |

## How to run

```bash
# terminal 1 (venv activated, see GUIDE.md)
pip install -r requirements.txt
waitress-serve --listen=127.0.0.1:8000 --threads=8 --call app:create_app

# terminal 2
k6 run loadtests/load_test.js                                   # main 2-minute test
k6 cloud login --token <YOUR_TOKEN> --stack <YOUR_STACK_SLUG>   # once
k6 cloud run --local-execution loadtests/load_test.js           # same, results to Grafana Cloud

LOGIN_RATE=100 k6 run loadtests/stress_test.js                  # exercise 1 / 2 / 3
PEAK=400 k6 run loadtests/ramp_test.js                          # exercise 4
EXPECT_401=1 k6 run loadtests/wrong_password_test.js            # exercise 5
```

## Section 6: questions about the 50 RPS run

Result of `k6 run loadtests/load_test.js` (2 minutes, 8 waitress threads, fresh server):

| Request | Count | avg | p95 | p99 | max | Errors |
|---|---|---|---|---|---|---|
| `GET /login` | 4800 | 0.97 ms | 1.73 ms | 4.1 ms | 39.5 ms | 0 |
| `POST /login` | 1201 | 15.4 ms | 20.97 ms | 23.8 ms | 48.6 ms | 0 |

**1. Did we hold 50 req/s for the full 2 minutes?**
Yes. There were 6001 requests at 50.0 req/s, and every full second stayed between 49 and 52
requests. `dropped_iterations` was 0, so k6 started every planned iteration on time.

**2. Which request is slower, by how much, and why?**
`POST /login` is about 16× slower on average (15.4 ms vs 0.97 ms) and about 12× slower at
p95 (21 ms vs 1.7 ms). `GET /login` only renders a template. `POST /login` calls
`verify_password()`, which runs `hash_password()`: PBKDF2-HMAC-SHA256 with **100,000
iterations**. That is about 11 ms of pure CPU work per login, and the slowness is on
purpose: it is what makes stolen hashes expensive to brute-force.

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
About **1 busy VU** (the sampled `vus` metric peaked at 1), even though 30 were
pre-allocated (`vus_max = 30`). This matches the rule of thumb: 40 × 0.001 s + 10 × 0.015 s
≈ 0.19 busy VUs on average.

## Exercises

### 1. Stress test: raise `login` to 50/s, then 100/s and beyond (8 threads)

Both of the rates the guide asks for pass easily, so I kept raising the rate to find the
break. `browse` stays at 40/s in every run.

| login/s | total req/s | GET p95 | POST p95 | dropped iters | Thresholds |
|---|---|---|---|---|---|
| 50 | 90 | 1.7 ms | 13.4 ms | 0 | ✅ pass |
| 100 | 140 | 1.0 ms | 12.9 ms | 0 | ✅ pass |
| 200 (1 min) | 240 | 0.8 ms | 13.9 ms | 0 | ✅ pass |
| 250 (1 min) | 290 | 1.0 ms | 19.8 ms | 13 | ❌ `dropped_iterations` |
| 300 (1 min) | 339 | 16 ms | 45 ms | 33 | ❌ `dropped_iterations` |
| 350 | 364 | 319 ms | 311 ms | 668 | ❌ `dropped_iterations`, `http_reqs` rate |
| 400 | 392 | 228 ms | 253 ms | 1192 | ❌ `dropped_iterations`, `http_reqs` rate |

**Thresholds start failing at about 250 logins/s (about 290 req/s in total).**
- **First to fail:** `dropped_iterations`. Latency is still fine at that point, but small
  hiccups push the work beyond the 10 pre-allocated VUs, and k6 drops an iteration
  each time it has to create a new VU mid-test.
- **Collapse at 350/s and above:** requests queue, p95 goes from about 15 ms to about 300 ms
  (20×), and k6 needs 200+ VUs.
- **Why `http_reqs` reports about half the target rate** (e.g. 198/s instead of 400/s): the
  rate is averaged over the whole run, including the 30 s `gracefulStop` while queued
  requests drain. A 30 s test that overruns lasts 60 s, which halves the reported rate.

### 2. Tune the server: `--threads=2` vs `8` vs `16`

| login/s | 2 threads | 8 threads | 16 threads |
|---|---|---|---|
| 100 | ✅ POST p95 16.9 ms | ✅ 12.9 ms | — |
| 150 | ❌ p95 **583 ms**, **1.95% errors**, 214 dropped | — | — |
| 200 | ❌ p95 644 ms, **26% errors** | ✅ 13.9 ms | ⚠️ p95 16 ms, 11 dropped |
| 250 | — | ⚠️ p95 19.8 ms, 13 dropped | ⚠️ p95 19.8 ms, 25 dropped |
| 300 | — | ⚠️ p95 45 ms, 33 dropped | ⚠️ p95 20 ms, 11 dropped |
| 400 | — | ❌ p95 253 ms, 1192 dropped | ❌ p95 188 ms, 98 dropped |

✅ = all thresholds pass. ⚠️ = only `dropped_iterations` fails, latency is still fine.
❌ = the server is overloaded.

What changes:
- **2 threads:** only 2 logins can hash at the same time. Capacity is about
  2 / 11.5 ms ≈ 170 logins/s minus overhead, so it breaks at **150/s**.
  - Requests wait in the queue (p95 about 580 ms).
  - k6 opens more and more connections to keep the rate. Past waitress's default
    `connection_limit` of 100, new connections are reset, which shows as status `0`
    (1.95%, then 26% failed requests).
- **8 → 16 threads:** almost the same ceiling (about 300 logins/s). The work is CPU-bound,
  and `hashlib.pbkdf2_hmac` releases the GIL, so threads do run in parallel, but only up to
  the 10 cores, which k6 also uses. Threads beyond the core count just queue on the CPU.
  16 threads only degrades more gently under overload (98 vs 1192 dropped at 400/s).
- **Conclusion:** more threads help until you run out of cores. After that you need more
  processes or machines (scale out), not more threads.

### 3. Security vs speed: 10,000 instead of 100,000 iterations

I changed it temporarily (8 threads), re-ran, then reverted:

| login/s | 100k: POST avg / p95 | 10k: POST avg / p95 |
|---|---|---|
| 50 | 12.1 ms / 13.4 ms | **3.3 ms / 6.2 ms** |
| 400 | 167 ms / 253 ms, 1192 dropped | 15.9 ms / 103 ms, 188 dropped |
| 800 | — | 30 ms / 204 ms, 3058 dropped ❌ |

- **Speed:** yes, it is faster: about 4× per login. It is not 10×, because the HTTP, Flask
  and session work stays the same. Capacity also improves, but the test still fails at
  400/s, because the bottleneck moves to Python request handling and to k6 sharing the CPU.
- **Why it is a bad trade in production:** the iteration count is the cost an attacker
  pays for **every password guess** if the user table leaks. 10× fewer iterations means
  10× more guesses per second on a GPU, so weak passwords fall 10× faster. The cost hits
  attackers billions of times but users only once per login. OWASP even recommends
  **600,000** iterations for PBKDF2-HMAC-SHA256, so 100k is already on the low side.
- **The right fix for login capacity** is to scale out (more workers or machines), add rate
  limiting on `/login`, or move hashing to a dedicated worker. Weakening the hash is not.

### 4. Ramp up: `ramping-arrival-rate` 0 → 50 → 0 over 3 minutes

`ramp_test.js`: 1m30s ramp up, 30 s hold, 1 min ramp down. POST /login latency per 10 s
window:

| Peak 50/s | rate | p50 | p95 |
|---|---|---|---|
| ramping up (30–40 s) | 20/s | 13.3 ms | 14.6 ms |
| at peak (100–120 s) | 50/s | 11.5 ms | 13.6 ms |
| ramping down (160–170 s) | 11/s | 13.3 ms | 18.9 ms |

**At 50/s the curve never bends.** p50 stays flat at 11–14 ms for the whole 3 minutes,
because 50 logins/s uses only about 0.6 of one core. The p95 blips (40–55 ms) are short
and appear at random times, not linked to the load.

To actually see the bend, I ran the same ramp with `PEAK=400`:

| window | rate | p50 | p95 |
|---|---|---|---|
| 40–50 s | 203/s | 12 ms | 17 ms |
| 60–70 s | 292/s | 14 ms | 22 ms |
| **70–80 s** | **319/s** | 45 ms | **254 ms** ← bend |
| 100–110 s | 373/s | 227 ms | 325 ms |
| 150–170 s (ramping down) | 107–157/s | 16 ms | **1,025–1,119 ms** |

- **Where it bends:** at **about 300–320 req/s**, the same knee as exercise 1. Below it,
  latency is flat. Above it, requests queue and p95 jumps 10×.
- **What failed:**
  - 1154 failed logins (2.8%): 1021 connection resets and 128 hit k6's 60 s request
    timeout.
  - 800 dropped iterations, and the 200-VU cap was reached.
- **Recovery lags behind:** p95 stays above 1 s for about 20 s after the load is already
  falling, while the backlog of stuck connections clears.

### 5. Wrong-password traffic at 5/s

`wrong_password_test.js` adds a `bad_login` scenario that expects `401`.

| Run | `http_req_failed` | Result |
|---|---|---|
| naive (`k6 run ...`) | **9.14%** | ❌ threshold `rate<0.01` crossed, k6 exit code 99 |
| `EXPECT_401=1` | 0.03% | ✅ pass |

**Yes, `http_req_failed` complains.** By default k6 counts every 4xx/5xx response as failed,
and 5 of 55 req/s are 401s (≈ 9%). The checks are still 100% green, because the app
behaves correctly. Only the metric's definition of "failed" is wrong for this request.

- **Fix:** mark 401 as the expected status for that one request:
  `responseCallback: http.expectedStatuses(401)`.
  - Setting it globally with `http.setResponseCallback(...)` would be worse: a real 401 on
    the *good* login would then be hidden.
- **Gotcha found on the way:** writing `responseCallback: undefined` turns failure
  tracking off completely for that request. The first naive run showed 0.03% because of
  this. The script now only adds the key when `EXPECT_401=1`.
- **Where the 0.03% comes from:** `setup()`'s `POST /register` returns 400 when the test
  user already exists from an earlier run against the same server, and that 400 counts as
  failed too. That is harmless under a 1% threshold, but `setup()` could pass
  `responseCallback: http.expectedStatuses(302, 400)` to be exact.
