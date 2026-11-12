# Answers: Full Stack with Docker Compose

Measured on a MacBook with Apple silicon (arm64), Docker Desktop, Docker Engine 29.9.2,
Docker Compose v5.6.1. Images are `linux/arm64`.

## How to run

```bash
cp .env.example .env          # sets POSTGRES_PASSWORD (exercise 1)
docker compose up --build -d
open http://localhost:5173
```

## What is in this folder

The project from the Docker assignment, plus everything the guide adds:

| File | Status |
| --- | --- |
| `docker-compose.yml` | New. As in the guide, plus `name: node-auth-app` and the password from `.env` (exercise 1) |
| `nginx.conf` | New, exactly as in the guide |
| `Dockerfile.multistage` | Updated as in the guide: copies `nginx.conf` |
| `.dockerignore` | Updated as in the guide, plus `.env` and `.env.example` |
| `.env.example`, `.gitignore` | Exercise 1: `.env` is ignored by Git and by Docker builds |
| `src/api.js` | New, replaces `src/auth.js` (deleted). Also has `userCount()` (exercise 5) |
| `src/main.js` | Updated `onSubmit` as in the guide, plus the user count on the welcome page |
| `tests/auth.spec.js` | Updated as in the guide (unique usernames), plus one test for exercise 5 |
| `backend/` | New: `Dockerfile`, `.dockerignore`, `package.json`, `src/{server,auth,db}.js` |

Additions on top of the guide, and why:

- **`name: node-auth-app`** at the top of the Compose file, so containers and the volume are
  called `node-auth-app-*` and `node-auth-app_db-data`, whatever the folder is named.
- **Three log lines in the backend** (`Registered user …`, `User … logged in`,
  `Failed login attempt`), so `docker compose logs backend` shows the traffic. Passwords are
  never logged.
- **`GET /api/users/count`** (exercise 5).

## 12. Start everything

```
$ docker compose up --build -d
 Image node-auth-app-backend Built
 Image node-auth-app-frontend Built
 Volume node-auth-app_db-data Created
 Network node-auth-app_default Created
 Container node-auth-app-db-1 Started
 Container node-auth-app-db-1 Waiting
 Container node-auth-app-db-1 Healthy
 Container node-auth-app-backend-1 Started
 Container node-auth-app-frontend-1 Started
```

The first run took 61 s, mostly pulling `node:26-alpine`, `nginx:stable-alpine` and
`postgres:18-alpine`. The start order is the one the guide describes: `db` → **Healthy** →
`backend` → `frontend`. `backend` only started after the healthcheck passed.

```
$ docker compose ps
NAME                       SERVICE    STATUS                    PORTS
node-auth-app-backend-1    backend    Up 9 seconds              3000/tcp
node-auth-app-db-1         db         Up 14 seconds (healthy)   5432/tcp
node-auth-app-frontend-1   frontend   Up 9 seconds              0.0.0.0:5173->80/tcp

$ docker compose logs backend
backend-1  | Backend listening on port 3000
```

Only `frontend` has a published port. From the Mac, `curl http://localhost:3000` gets no
answer: the backend can only be reached through nginx.

### How the containers find each other

All three are on the network `node-auth-app_default`:

```
node-auth-app-db-1        172.18.0.2/16
node-auth-app-backend-1   172.18.0.3/16
node-auth-app-frontend-1  172.18.0.4/16

$ docker compose exec frontend getent hosts backend db
172.18.0.3        backend
172.18.0.2        db
```

Compose's DNS turns the service names into these IPs. That is why `nginx.conf` can say
`proxy_pass http://backend:3000` and `DATABASE_URL` can say `@db:5432`. The nginx access log
shows the `/api/` calls it forwards:

```
frontend-1 | "POST /api/register HTTP/1.1" 201 20
frontend-1 | "POST /api/login HTTP/1.1" 401 40
frontend-1 | "GET /api/users/count HTTP/1.1" 200 11
```

| Image | Size |
| --- | --- |
| `node-auth-app-frontend` | 92.3 MB (same as `:multistage` in the last assignment, plus `nginx.conf`) |
| `node-auth-app-backend` | 271 MB (`node:26-alpine` + 79 packages from `npm ci --omit=dev`) |
| `postgres:18-alpine` | 425 MB |

## 13. Confirm it works

All API answers through nginx (`http://localhost:5173/api/...`):

| Request | Answer |
| --- | --- |
| register `alice` / `secret123` | `201 {"username":"alice"}` |
| register `alice` again | `400 {"error":"Username already taken"}` |
| password `short1` | `400 {"error":"Password must be at least 8 characters"}` |
| password `nodigitshere` | `400 {"error":"Password must contain at least one digit"}` |
| username `a!` | `400 {"error":"Username must be 3-20 characters: letters, digits or underscore"}` |
| login `" Alice "` / `secret123` | `200 {"username":"alice"}` (trimmed and lower-cased) |
| login with `wrong-pass1` | `401 {"error":"Invalid username or password"}` |
| body `{bad json` | `400 {"error":"Invalid JSON"}` |

In the browser the same messages appear in the red box: they now come from the backend.

```
$ docker compose exec backend wget -qO- http://localhost:3000/api/health
{"status":"ok"}

$ docker compose exec db psql -U app -d auth -c "SELECT username, created_at, left(password_hash,40) AS hash FROM users;"
 username |          created_at           |                   hash
----------+-------------------------------+------------------------------------------
 alice    | 2026-11-12 18:59:06.176396+00 | edf2c77cdf8b14d1587e7bdc6095dd8d$9530dc7
```

Only a salt and a hash are stored, never the password.

Playwright (with the stack running, so `reuseExistingServer` tests the Compose stack):

```
$ npx playwright test
  ✓  1 [chromium] › tests/auth.spec.js:24:1 › registered user can log in (463ms)
  ✓  2 [chromium] › tests/auth.spec.js:32:1 › login with invalid credentials shows an error (384ms)
  ✓  3 [chromium] › tests/auth.spec.js:41:1 › welcome page shows the user count (323ms)

  3 passed (3.4s)
```

Second run: `3 passed (1.6s)`. Unique usernames mean the tests never clash with users that are
already in the database. Test 3 is new for exercise 5.

## 14. Persistence

```
$ docker compose down            # containers and network removed, volume kept
$ docker compose up -d
login alice → {"username":"alice"}

$ docker volume ls
local     node-auth-app_db-data

$ docker compose down -v
 Volume node-auth-app_db-data Removed
$ docker compose up -d
login alice → 401 {"error":"Invalid username or password"}
users/count → {"count":0}
```

`down` deletes the containers but not the volume, so the new Postgres container finds its old
files. `down -v` deletes the volume too, and the data is gone.

## 15. Exercises

### Exercise 1: Secrets out of the file

`.env` (not committed, not copied into images):

```
POSTGRES_PASSWORD=app_password
```

`docker-compose.yml` uses it in both places:

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env (see .env.example)}
DATABASE_URL: postgres://app:${POSTGRES_PASSWORD}@db:5432/auth
```

`.env` is in `.gitignore` and `.dockerignore`. `.env.example` is committed, so the next
developer knows which variable to set. I used `${VAR:?message}` instead of plain `${VAR}`:
without `.env`, plain `${VAR}` silently becomes an empty string. With `:?`, Compose refuses to
start and says why:

```
$ mv .env .env.bak && docker compose config
error while interpolating services.db.environment.POSTGRES_PASSWORD: required variable
POSTGRES_PASSWORD is missing a value: set POSTGRES_PASSWORD in .env (see .env.example)
```

`docker compose config` shows the final file with the value filled in, which is a quick way to
check that `.env` was read.

### Exercise 2: Resilience

I logged in every 0.25 s (40 requests) while running `docker compose restart db`:

```
4  × 200 {"username":"alice"}               before the restart
1  × 500 {"error":"Internal server error"}  during the restart (18:59:57.79)
35 × 200 {"username":"alice"}               after (from 18:59:58.11)
```

Postgres restarted in about 0.2 s (shut down at 57.713, ready at 57.907). **During** the restart,
the user sees *"Server unavailable, please try again"*: `api.js` turns any 5xx into that message.
**After** the restart, logging in just works. Nobody had to restart the backend.

`docker compose logs backend`:

```
backend-1  | Database connection lost: terminating connection due to administrator command
backend-1  | Error: getaddrinfo ENOTFOUND db
backend-1  |     at async login (file:///app/src/auth.js:57:20)
```

1. `Database connection lost`: Postgres closed the idle pooled connection on shutdown. The
   `pool.on("error")` handler in `db.js` logged it instead of crashing the process.
2. `ENOTFOUND db`: one request arrived while the `db` container was stopped. A stopped
   container has no IP, so the name `db` did not resolve. The query failed, Express's error
   handler logged it and answered `500` in JSON (no stack trace sent to the user).
3. The next request made the pool open a fresh connection to the new container. It worked.

The backend container stayed `Up` the whole time.

### Exercise 3: Connect a database tool

I added the port with an override file instead of editing `docker-compose.yml`, so it can be
used for debugging only:

```bash
docker compose -f docker-compose.yml -f ports.yml up -d db
```

```yaml
# ports.yml
services:
  db:
    ports:
      - "5432:5432"
```

On my Mac this showed a trap. A Postgres installed with Homebrew already listens on
`127.0.0.1:5432`, and Docker binds `*:5432`. Both start without error, but `localhost:5432`
reaches the **Mac's** Postgres:

```
$ psql -h localhost -p 5432 -U app -d auth
FATAL:  role "app" does not exist
```

So I published it as `"5433:5432"` instead and connected with `psql` (DBeaver and pgAdmin
use the same host/port/user/password/database):

```
$ PGPASSWORD=app_password psql -h localhost -p 5433 -U app -d auth -c "SELECT username, created_at FROM users;"
 username |          created_at
----------+------------------------------
 alice    | 2026-11-12 18:59:56.50282+00
```

**Why it is safer to leave it unpublished in production:**

- `"5432:5432"` binds to `0.0.0.0`, every network interface, not just localhost. From the
  Mac's Wi-Fi address (`192.168.x.x`), the container's database answered
  (`select count(*) from users` → `1`). Anyone on the same network could try passwords
  against it. On a server with a public IP, that is the whole internet. Publicly reachable
  Postgres servers get scanned and brute-forced constantly.
- The only thing that needs the database is the backend, and it reaches it over the private
  Compose network. Not publishing the port removes a whole attack surface. Attackers must go
  through the API, which only allows register and login with parameterised SQL.
- If you need access for debugging, publish it only on localhost (`"127.0.0.1:5433:5432"`),
  only temporarily (an override file like the one above), or use
  `docker compose exec db psql`, which needs no port at all.

Afterwards I ran `docker compose up -d db` without the override, and the port was gone again
(`db 5432/tcp`).

### Exercise 4: The first-run trap

With `.env`, the password is in one place, so I changed `.env` to
`POSTGRES_PASSWORD=new_password_42` and ran `docker compose up -d`. Compose recreated `db` and
`backend` (their environment changed), and then:

```
backend: Exited (1)
db: Up (healthy)

backend-1  | error: password authentication failed for user "app"
backend-1  |   code: '28P01',
```

**Why:** the Postgres image reads `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` **only
when the data directory is empty**, to create the cluster. The volume already had a database,
so the logs say `Database directory appears to contain a database; Skipping initialization`
and the user `app` keeps its **old** password. The backend now uses the new password in
`DATABASE_URL`, authentication fails in `initDb()`, and the process exits. The `db`
healthcheck still says healthy: `pg_isready` checks that Postgres accepts connections, not that
the password is right.

**Two fixes:**

1. Keep the data, change the password inside the database (what I did):

   ```bash
   docker compose exec db psql -U app -d auth -c "ALTER USER app WITH PASSWORD 'new_password_42';"
   docker compose up -d        # restarts the exited backend
   ```

   `exec` works without a password because it connects through the local Unix socket inside
   the container, which the image trusts. After that, logging in as `alice` worked again.
2. Throw the data away: `docker compose down -v && docker compose up -d`. The empty volume
   makes Postgres initialise again with the new password. Fine on a laptop, never in production.

Afterwards I set the password back to `app_password` the same way.

### Exercise 5: New endpoint

`backend/src/auth.js`:

```js
export async function countUsers() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  return rows[0].count;
}
```

`::int` matters: `COUNT(*)` is a `bigint`, and `pg` returns bigints as **strings** (`"1"`) so
it never loses precision. Casting to `int` gives a real JSON number.

`backend/src/server.js`:

```js
app.get("/api/users/count", async (req, res) => {
  res.json({ count: await countUsers() });
});
```

```
$ curl http://localhost:5173/api/users/count
{"count":1}
```

The frontend calls it from `api.userCount()` when the welcome page renders, and shows
*"1 registered user in the database."* (plural for 0 or 2+). If the call fails, it shows
*"User count unavailable."* instead of breaking the page. Test 3 in `tests/auth.spec.js` checks
it. No nginx change was needed: `/api/users/count` already matches `location /api/`.

## Cleanup

The stack is left running for the demo. To stop it:

```bash
docker compose down        # keep the users
docker compose down -v     # also delete the database volume
```
