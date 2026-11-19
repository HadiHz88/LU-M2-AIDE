# Full Stack with Docker Compose: solution guide

This lab moves the users of the auth app out of the browser and into PostgreSQL. You add a small
Express backend between the two, and Docker Compose starts three containers with one command:
nginx (frontend), Express (backend) and Postgres (database).

**Starting point:** this lab has no `starter.zip`. The handout starts from the `node-auth-app`
folder of the Docker lab, so you start from that lab's starter: unzip
`04_docker_containers/starter.zip`. `solution/` holds only what this lab adds or changes on top of
it (exercises 1 and 5 included), and you also delete `src/auth.js`. The last section lists every
file.

All results below were measured on a MacBook with Apple silicon (arm64), Docker Desktop, Docker
Engine 29.9.2 and Docker Compose v5.6.1, with `linux/arm64` images. Check that Compose is
installed with `docker compose version`.

## 1. The architecture

Three services share one Compose network. Only `frontend` (nginx) publishes a port, `5173` on
your machine. nginx serves the built files and forwards every `/api/...` request to the host
`backend`, which connects to the host `db`. Compose turns service names into hostnames, so nothing
needs an IP address. Postgres keeps its files in the named volume `db-data`.

## Part 1: Create the backend

### 2. Set up the project

From the `node-auth-app` folder:

```bash
mkdir -p backend/src
cd backend
npm init -y
npm pkg set type=module scripts.start="node src/server.js"
npm install express pg
cd ..
```

`backend/package.json` ends up with `"type": "module"`, the `start` script, `express ^5.3.0` and
`pg ^8.23.1`. npm wrote the version that was current; the handout's `^8.23.0` makes no
difference. `"type": "module"` lets you use `import` and the top-level `await` in `server.js`. Keep
`backend/package-lock.json`: the Dockerfile's `npm ci` refuses to run without it.

### 3. The database connection: `backend/src/db.js`

The file is exactly the handout's. The part that matters later:

```js
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// If the database restarts, idle connections break. Log it instead of crashing:
// the pool opens fresh connections on the next query.
pool.on("error", (err) => console.error("Database connection lost:", err.message));
```

- The connection string comes from `DATABASE_URL`, so no password is written in the code.
- The pool keeps connections open and reuses them, faster than connecting per request.
- Without the `error` listener, a dropped idle connection would crash the process (exercise 2).
- `initDb()` runs `CREATE TABLE IF NOT EXISTS users (...)`, safe on every start. `username` is
  the `PRIMARY KEY`, so duplicates are impossible at the database level.

### 4. The logic: `backend/src/auth.js`

The rules are the same as in the browser's old `src/auth.js`. Hashing now uses `node:crypto`
with the same settings (16-byte salt, PBKDF2-SHA256, 100 000 iterations, 32 bytes), so the stored
value is still `salt$hash` in hex. The Map is replaced by the `users` table:

```js
export async function register(rawUsername, password) {
  const username = normalize(rawUsername);
  validate(username, String(password));
  try {
    // $1, $2 are parameters: never build SQL by pasting user input into the string.
    await pool.query("INSERT INTO users (username, password_hash) VALUES ($1, $2)", [
      username,
      await hashPassword(String(password)),
    ]);
  } catch (err) {
    if (err.code === "23505") throw new AuthError("Username already taken"); // unique violation
    throw err;
  }
  return username;
}
```

- `$1` and `$2` send the values separately from the SQL. That is what prevents SQL injection.
- There is no "does this user exist?" check before the `INSERT`. The primary key rejects the
  duplicate, and error code `23505` (unique violation) becomes a friendly `AuthError`. Two
  requests at the same moment cannot both slip through, which a check-then-insert would allow.
- `login()` selects `password_hash` with the same `$1` style, returns the normalised name on
  success and `null` otherwise. `verifyPassword()` compares with `timingSafeEqual`, so response
  times leak nothing about the hash.
- `String(...)` copes with whatever JSON the client sends, even a number.

### 5. The API: `backend/src/server.js`

The handout's file, plus three log lines (`Registered user …`, `User … logged in`,
`Failed login attempt`) so `docker compose logs backend` shows the traffic, and the exercise 5
route. Passwords are never logged. The login route and the error handler:

```js
app.post("/api/login", async (req, res) => {
  const { username = "", password = "" } = req.body ?? {};
  const name = await login(username, password);
  if (!name) {
    console.log("Failed login attempt");
    return res.status(401).json({ error: "Invalid username or password" });
  }
  console.log(`User ${name} logged in`);
  res.json({ username: name });
});
```

```js
// Any error not handled above ends up here: answer in JSON, never leak a stack trace.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
```

- Status codes carry the meaning: `201` created, `400` bad input, `401` wrong credentials, `500`
  server problem. The frontend's `api.js` relies on them. Register answers `201` or, on an
  `AuthError`, `400` with its message.
- `req.body ?? {}` and the `= ""` defaults cover a request with no body or missing fields.
- In Express 5, an error thrown in an `async` route reaches the error handler by itself.
  `entity.parse.failed` is what `express.json()` raises on malformed JSON.
- `await initDb()` runs before `app.listen`, so the API only takes requests once the table
  exists. If the database refuses the connection, the process exits (exercise 4).
- On `SIGTERM` (sent by `docker compose down`) the server closes, then the pool, then exits `0`.

### 6. The backend image: `backend/Dockerfile`

```dockerfile
FROM node:26-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev          # production dependencies only

COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

# Run node directly (not via npm) so it receives the stop signal from Docker.
CMD ["node", "src/server.js"]
```

- `npm ci --omit=dev` installs only what the server needs to run. The package files are copied
  before `src`, so a code change reuses the cached `npm ci` layer.
- There is no build step: the source is the app.
- `CMD ["node", ...]` makes Node the process that receives Docker's `SIGTERM`, so the handler in
  `server.js` runs.
- `backend/.dockerignore` lists `node_modules`, `.dockerignore` and `Dockerfile`, so a local
  `backend/node_modules` never enters the image.

## Part 2: Connect the frontend

### 7. Replace the in-memory store: `src/api.js`

Delete `src/auth.js` (`rm src/auth.js`): validation and hashing now live in the backend. Then
create `src/api.js`. The handout puts the `fetch` inside one `post()` function. The solution
splits it into `request()` and a short `post` wrapper, so the `GET` of exercise 5 shares the same
error handling:

```js
async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, options);
  } catch {
    throw new ApiError("Server unavailable, please try again"); // no network at all
  }
  // 5xx: backend crashed, or nginx can't reach it (502 Bad Gateway).
  if (res.status >= 500) throw new ApiError("Server unavailable, please try again");
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const post = (path, body) =>
  request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
```

`register()` and `login()` are exactly as in the handout: `register` throws an `ApiError` with
the server's message when the answer is not OK, `login` returns `null` on `401`.

- `/api/...` is a relative URL, so the request goes to nginx, the server that served the page.
  No CORS setup is needed.
- `fetch` only throws when there is no network at all. A `5xx` gets the same "Server
  unavailable" message.
- The frontend no longer validates anything. It shows the server's message: the server is the
  single source of truth.

### 8. Update `src/main.js`

The top now imports `* as api from "./api.js"` instead of `AuthError, UserStore`, and the
`const users = new UserStore()` line is gone. `onSubmit` is replaced as in the handout:

```js
async function onSubmit(event, mode) {
  event.preventDefault();
  const form = event.target;
  const { username, password } = Object.fromEntries(new FormData(form));
  form.querySelector("button").disabled = true; // wait for the server

  try {
    if (mode === "register") {
      const name = await api.register(username, password);
      flash = { type: "success", text: `Account created for ${name}. Please log in.` };
      return go("/login");
    }
    const name = await api.login(username, password);
    if (name) {
      currentUser = name;
      return go("/welcome");
    }
    flash = { type: "error", text: "Invalid username or password" };
  } catch (err) {
    if (!(err instanceof api.ApiError)) throw err;
    flash = { type: "error", text: err.message };
  }
  render();
}
```

- One `try` covers both modes. An `ApiError` becomes the red flash message. Anything else is a
  real bug, so it is thrown again instead of hidden.
- `currentUser = name` uses the name the server returns, already trimmed and lower-cased.
- The button stays disabled until the form re-renders, so a slow server cannot get a double
  submit.

The rest is unchanged, apart from the user count on the welcome page (exercise 5).

### 9. Forward /api to the backend: `nginx.conf`

`nginx.conf` is exactly the handout's. `location /` serves the built files with
`try_files $uri $uri/ /index.html`, and this block makes nginx a reverse proxy:

```nginx
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
```

`proxy_pass` has no path after the port, so nginx forwards the path unchanged: `/api/register`
reaches Express as `/api/register`. That is why the Express routes keep the `/api` prefix.

`Dockerfile.multistage` gets one new instruction in the nginx stage, before the built files are
copied. It replaces the image's default site config with yours:

```dockerfile
# Our config: serve the files and forward /api/ to the backend.
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

### 10. Keep the frontend image clean: `.dockerignore`

Compared with the starter, `.dockerignore` adds `tests`, `playwright.config.js`, `backend`,
`docker-compose.yml`, `.env` and `.env.example` (the last one is not in the handout, but the
image does not need it either). The frontend image is built from the project root and
`COPY . .` copies the whole context, so without `backend` the backend source and any local
`backend/node_modules` would be sent along. `.env` stays out so the password never lands in an
image layer (exercise 1).

## Part 3: Docker Compose

### 11. Describe the stack: `docker-compose.yml`

```yaml
name: node-auth-app

services:
  db:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env (see .env.example)}
      POSTGRES_DB: auth
    volumes:
      - db-data:/var/lib/postgresql # named volume: data survives container restarts
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d auth"]
      interval: 5s
      timeout: 3s
      retries: 10

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgres://app:${POSTGRES_PASSWORD}@db:5432/auth
      PORT: 3000
    depends_on:
      db:
        condition: service_healthy # wait until Postgres accepts connections

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.multistage
    ports:
      - "5173:80" # host:container. Only the frontend is reachable from your machine.
    depends_on:
      - backend

volumes:
  db-data:
```

Two differences from the handout:

- `name: node-auth-app` fixes the project name: containers are `node-auth-app-db-1` and so on,
  the volume is `node-auth-app_db-data`, whatever your folder is called.
- The password comes from `.env` (exercise 1). So before the first start, run
  `cp .env.example .env` and choose a password.

Why the rest is written this way:

- `healthcheck` plus `condition: service_healthy`: a started Postgres is not yet a ready one, and
  `initDb()` would fail if the backend connected too early.
- The volume is mounted at `/var/lib/postgresql`, which is right for Postgres 18. The
  `/var/lib/postgresql/data` path of older tutorials is for Postgres 17 and older.
- Only `frontend` has `ports`. The backend and the database stay private to the network.
- `frontend` depends on `backend` so the `backend` hostname exists when nginx starts.

### 12. Start everything

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
`postgres:18-alpine`. The order is the handout's: `db`, then **Healthy**, then `backend`, then
`frontend`. Without `-d`, wait for `Backend listening on port 3000` in the mixed logs and stop
with Ctrl+C.

```
$ docker compose ps
NAME                       SERVICE    STATUS                    PORTS
node-auth-app-backend-1    backend    Up 9 seconds              3000/tcp
node-auth-app-db-1         db         Up 14 seconds (healthy)   5432/tcp
node-auth-app-frontend-1   frontend   Up 9 seconds              0.0.0.0:5173->80/tcp

$ docker compose logs backend
backend-1  | Backend listening on port 3000
```

Only `frontend` has a published port. From the Mac, `curl http://localhost:3000` gets no answer:
the backend is reachable only through nginx.

**How the containers find each other.** All three are on the network `node-auth-app_default`:

```
node-auth-app-db-1        172.18.0.2/16
node-auth-app-backend-1   172.18.0.3/16
node-auth-app-frontend-1  172.18.0.4/16

$ docker compose exec frontend getent hosts backend db
172.18.0.3        backend
172.18.0.2        db
```

Compose's DNS turns service names into these IPs. That is why `nginx.conf` can say
`backend:3000` and `DATABASE_URL` can say `@db:5432`. The nginx access log shows what it forwards:

```
frontend-1 | "POST /api/register HTTP/1.1" 201 20
frontend-1 | "POST /api/login HTTP/1.1" 401 40
frontend-1 | "GET /api/users/count HTTP/1.1" 200 11
```

| Image | Size |
| --- | --- |
| `node-auth-app-frontend` | 92.3 MB (same as `:multistage` in the Docker lab, plus `nginx.conf`) |
| `node-auth-app-backend` | 271 MB (`node:26-alpine` + 79 packages from `npm ci --omit=dev`) |
| `postgres:18-alpine` | 425 MB |

### 13. Confirm it works

Open http://localhost:5173, register `alice` / `secret123`, log in, log out, then try a short
password and a duplicate username. The messages in the red box now come from the backend. The
same requests sent through nginx (`http://localhost:5173/api/...`) gave:

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

The backend and the database answer through `exec`, no published port needed:

```
$ docker compose exec backend wget -qO- http://localhost:3000/api/health
{"status":"ok"}

$ docker compose exec db psql -U app -d auth -c "SELECT username, created_at, left(password_hash,40) AS hash FROM users;"
 username |          created_at           |                   hash
----------+-------------------------------+------------------------------------------
 alice    | 2026-11-12 18:59:06.176396+00 | edf2c77cdf8b14d1587e7bdc6095dd8d$9530dc7
```

Only a salt and a hash are stored, never the password.

**The Playwright tests.** The database keeps users between runs, so registering `alice` again
would fail with "Username already taken". In `tests/auth.spec.js`, each test now registers its
own user:

```js
const uniqueName = () => `user_${Math.random().toString(36).slice(2, 10)}`;
```

```js
test.beforeEach(async ({ page }) => {
  username = uniqueName();
  await page.goto("/#/register");
  await submitForm(page, username, "secret123", "Register");
  await expect(page.getByRole("alert")).toHaveText(`Account created for ${username}. Please log in.`);
});
```

The two tests use the shared `let username` instead of `"alice"`. These names always pass the
backend's username rule. Run the tests with the stack up: `playwright.config.js` has
`reuseExistingServer: true` and nginx already answers on port 5173, so they test the Compose
stack.

```
$ npx playwright test
  ✓  1 [chromium] › tests/auth.spec.js:24:1 › registered user can log in (463ms)
  ✓  2 [chromium] › tests/auth.spec.js:32:1 › login with invalid credentials shows an error (384ms)
  ✓  3 [chromium] › tests/auth.spec.js:41:1 › welcome page shows the user count (323ms)

  3 passed (3.4s)
```

The handout expects 2 passed; test 3 is for exercise 5. A second run gave `3 passed (1.6s)`:
unique names never clash with users already in the database.

### 14. Persistence: the volume in action

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

`.env.example` is committed, so the next developer knows which variable to set:

```
# Copy this file to .env and choose a password: cp .env.example .env
# Compose reads .env automatically. .env is in .gitignore and .dockerignore.
POSTGRES_PASSWORD=change_me
```

Your own `.env` holds the real value (the recorded runs kept the handout's `app_password`). The
`db` and `backend` services in `docker-compose.yml` both use it:

```yaml
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env (see .env.example)}
```

```yaml
      DATABASE_URL: postgres://app:${POSTGRES_PASSWORD}@db:5432/auth
```

`.env` is in `.gitignore` and `.dockerignore`. The `:?` form matters: without `.env`, a plain
`${POSTGRES_PASSWORD}` silently becomes an empty string. With `:?`, Compose refuses to start
and says why:

```
$ mv .env .env.bak && docker compose config
error while interpolating services.db.environment.POSTGRES_PASSWORD: required variable
POSTGRES_PASSWORD is missing a value: set POSTGRES_PASSWORD in .env (see .env.example)
```

`docker compose config` prints the final file with the values filled in, a quick way to check
that `.env` was read.

### Exercise 2: Resilience

Logging in every 0.25 s (40 requests) during `docker compose restart db` gave:

```
4  × 200 {"username":"alice"}               before the restart
1  × 500 {"error":"Internal server error"}  during the restart (18:59:57.79)
35 × 200 {"username":"alice"}               after (from 18:59:58.11)
```

Postgres restarted in about 0.2 s (shut down at 57.713, ready at 57.907). **During** the restart
the user sees "Server unavailable, please try again": `api.js` turns any `5xx` into that message.
**After** it, logging in just works. Nobody had to restart the backend.

```
$ docker compose logs backend
backend-1  | Database connection lost: terminating connection due to administrator command
backend-1  | Error: getaddrinfo ENOTFOUND db
backend-1  |     at async login (file:///app/src/auth.js:57:20)
```

1. `Database connection lost`: Postgres closed the idle pooled connection on shutdown. The
   `pool.on("error")` handler in `db.js` logged it instead of crashing the process.
2. `ENOTFOUND db`: one request arrived while the `db` container was stopped. A stopped container
   has no IP, so the name `db` did not resolve. The error handler logged it and answered `500`
   in JSON, with no stack trace sent to the user.
3. The next request made the pool open a fresh connection to the new container. It worked.

The backend container stayed `Up` the whole time.

### Exercise 3: Connect a database tool

Add the port with an override file instead of editing `docker-compose.yml`, so it only exists
while you debug (this file is not in `solution/`):

```yaml
# ports.yml
services:
  db:
    ports:
      - "5432:5432"
```

```bash
docker compose -f docker-compose.yml -f ports.yml up -d db
```

On the Mac this showed a trap. A Postgres installed with Homebrew already listened on
`127.0.0.1:5432`, and Docker binds `*:5432`. Both start without error, but `localhost:5432`
reaches the **Mac's** Postgres:

```
$ psql -h localhost -p 5432 -U app -d auth
FATAL:  role "app" does not exist
```

Publishing `"5433:5432"` instead worked. DBeaver and pgAdmin take the same host, port, user,
password and database as `psql`:

```
$ PGPASSWORD=app_password psql -h localhost -p 5433 -U app -d auth -c "SELECT username, created_at FROM users;"
 username |          created_at
----------+------------------------------
 alice    | 2026-11-12 18:59:56.50282+00
```

**Why it is safer to leave it unpublished in production:**

- `"5432:5432"` binds to `0.0.0.0`, every network interface. From the Mac's Wi-Fi address
  (`192.168.x.x`) the container's database answered (`select count(*) from users` gave `1`).
  Anyone on the same network can try passwords against it; on a server with a public IP, the
  whole internet can. Public Postgres servers get scanned and brute-forced constantly.
- Only the backend needs the database, over the private Compose network. Without the port,
  attackers must go through the API, which only allows register and login with parameterised
  SQL.
- For debugging, publish on localhost only (`"127.0.0.1:5433:5432"`), only temporarily (an
  override file like the one above), or use `docker compose exec db psql`, which needs no port.

Running `docker compose up -d db` without the override removed the port again (`db 5432/tcp`).

### Exercise 4: The first-run trap

With `.env` the password lives in one place, so change it there (the recorded run used
`POSTGRES_PASSWORD=new_password_42`) and run `docker compose up -d`. Compose recreates `db` and
`backend` (their environment changed), and then:

```
backend: Exited (1)
db: Up (healthy)

backend-1  | error: password authentication failed for user "app"
backend-1  |   code: '28P01',
```

**Why:** the Postgres image reads `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` **only
when the data directory is empty**, to create the cluster. The volume already holds a database,
so the logs say `Database directory appears to contain a database; Skipping initialization` and
the user `app` keeps its **old** password. The backend sends the new one in `DATABASE_URL`,
authentication fails in `initDb()`, and the process exits. The `db` healthcheck still says
healthy: `pg_isready` checks that Postgres accepts connections, not that the password is right.

**Two fixes:**

1. Keep the data and change the password inside the database (what the solution did):

   ```bash
   docker compose exec db psql -U app -d auth -c "ALTER USER app WITH PASSWORD 'new_password_42';"
   docker compose up -d        # restarts the exited backend
   ```

   `exec` needs no password: it connects through the local Unix socket inside the container,
   which the image trusts. After that, logging in as `alice` worked again.
2. Throw the data away: `docker compose down -v && docker compose up -d`. The empty volume makes
   Postgres initialise again with the new password. Fine on a laptop, never in production.

The password was then set back to `app_password` the same way.

### Exercise 5: New endpoint

`backend/src/auth.js`:

```js
export async function countUsers() {
  // COUNT(*) is a bigint, which pg returns as a string to avoid precision loss.
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  return rows[0].count;
}
```

Without `::int` the answer would be the string `"1"`. The cast gives a real JSON number.

`backend/src/server.js` imports `countUsers` and adds:

```js
app.get("/api/users/count", async (req, res) => {
  res.json({ count: await countUsers() });
});
```

```
$ curl http://localhost:5173/api/users/count
{"count":1}
```

No nginx change is needed: `/api/users/count` already matches `location /api/`.

On the frontend, `src/api.js` adds `userCount()`, a `GET` through the same `request()` that
throws an `ApiError` if the answer is not OK. `src/main.js` adds a
`<p class="count" id="user-count">` to the welcome page and fills it in after rendering:

```js
async function showUserCount(el) {
  try {
    const count = await api.userCount();
    el.textContent = `${count} registered user${count === 1 ? "" : "s"} in the database.`;
  } catch {
    el.textContent = "User count unavailable.";
  }
}
```

The page shows "1 registered user in the database." (plural for 0 or 2 and more). If the call
fails, it shows "User count unavailable." instead of breaking the page. `src/style.css` adds a
`.count` rule (grey, smaller text). Test 3 in `tests/auth.spec.js` logs in and expects
`#user-count` to match `/^\d+ registered users? in the database\.$/`.

## Files in solution/

| File | Status | What it does |
| --- | --- | --- |
| `docker-compose.yml` | new | The three services, the healthcheck, the volume; password from `.env` |
| `nginx.conf` | new | Serves the built files and forwards `/api/` to `backend:3000` |
| `.env.example` | new | Template for `.env` (exercise 1) |
| `backend/package.json`, `backend/package-lock.json` | new | Express and `pg`; the lock file is needed by `npm ci` |
| `backend/Dockerfile`, `backend/.dockerignore` | new | Backend image: production dependencies, `node src/server.js` |
| `backend/src/db.js` | new | Connection pool and the `users` table |
| `backend/src/auth.js` | new | Validation, PBKDF2 hashing, parameterised SQL, `countUsers()` |
| `backend/src/server.js` | new | The JSON API, error handler, clean `SIGTERM` shutdown |
| `src/api.js` | new | Calls the backend through `/api`, replaces `src/auth.js` |
| `src/main.js` | changed | Uses `api.js` in `onSubmit`; user count on the welcome page |
| `src/style.css` | changed | Adds the `.count` style |
| `tests/auth.spec.js` | changed | Unique usernames per test, plus the exercise 5 test |
| `Dockerfile.multistage` | changed | Copies `nginx.conf` into the nginx stage |
| `.dockerignore` | changed | Also excludes tests, `backend`, the Compose file and `.env` |
| `.gitignore` | changed | Adds `.env` (exercise 1) and `.DS_Store` |
| `src/auth.js` | **delete** | Its logic moved to `backend/src/auth.js` |

`Dockerfile`, `index.html`, `package.json`, `package-lock.json` and `playwright.config.js` are
unchanged from the starter. To get the finished project, from the `assignments` folder:

```bash
unzip 04_docker_containers/starter.zip -d work     # creates work/node-auth-app/
rm work/node-auth-app/src/auth.js
cp -R 05_docker_compose/solution/. work/node-auth-app/
cd work/node-auth-app
cp .env.example .env          # then choose a password in .env
docker compose up --build -d
open http://localhost:5173
```

Stop with `docker compose down` (keeps the users) or `docker compose down -v` (also deletes the
database volume).
