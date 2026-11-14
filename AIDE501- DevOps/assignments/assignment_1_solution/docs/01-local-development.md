# 1. Develop and run the app locally (Windows)

## Install once

| Tool | Why | Get it |
|---|---|---|
| Node.js 22 LTS (or newer LTS) | Run React and Express | <https://nodejs.org> |
| Git | Version control | <https://git-scm.com> |
| Docker Desktop (WSL 2 backend) | Containers, and the easiest way to get Postgres | <https://docs.docker.com/desktop/setup/install/windows-install/> |
| VS Code + "REST Client" extension | Edit code, run `api.http` | <https://code.visualstudio.com> |

Check in PowerShell:

```powershell
node -v; npm -v; git --version; docker version
```

## What the app does

**Campus Events** lets students browse campus events, search and filter them,
create events, and reserve a seat (with a capacity limit).

| Page | Route | Interactivity |
|---|---|---|
| Home | `/` | Live stats from the API, next 3 events |
| Events | `/events` | Search box + category filter (queries the API) |
| Event detail | `/events/:id` | Reserve / cancel a seat, capacity bar, delete (organizer only) |
| Create | `/events/new` | Form, protected: redirects to sign-in |
| Sign in / Register | `/login` | JWT authentication |
| About | `/about` | Live API + DB health, API table |

Navigation: top bar on desktop, hamburger menu under 720 px (responsive).

## Run it without containers (development mode)

Three processes: Postgres, the API, the React dev server.

```powershell
# 0) secrets for the database (root of the project)
copy .env.example .env          # edit POSTGRES_PASSWORD and JWT_SECRET

# 1) database only, in Docker, published on 127.0.0.1:5432
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db

# 2) API (terminal 1)
cd backend
copy .env.example .env          # put the same POSTGRES_PASSWORD in DATABASE_URL
npm install
npm run dev                     # http://localhost:3000/api/health

# 3) React (terminal 2)
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

Port 5432 already taken by a local Postgres? Add `DB_PORT=5433` to the root
`.env` and use `localhost:5433` in `backend/.env`.

Vite forwards `/api/*` to `localhost:3000` (see `frontend/vite.config.js`), the
same job nginx does in production.

## Test in the browser (checklist)

- [ ] Home shows stats and three upcoming events
- [ ] Events: typing "docker" filters the list; the category dropdown filters too
- [ ] Clicking "Create" while signed out redirects to Sign in
- [ ] Register a user, you land back where you were
- [ ] Reserve a seat → "1 going", button becomes "Cancel my seat"
- [ ] Create an event with capacity 1, reserve it, sign in as another user → "Event is full"
- [ ] Only the organizer sees "Delete event"
- [ ] Shrink the window (or DevTools device mode) → hamburger menu
- [ ] Reload on `/events/1` still works (SPA routing)
