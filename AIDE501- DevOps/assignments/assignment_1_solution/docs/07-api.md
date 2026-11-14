# 6. Demonstrate the API

The React app is just one client of a REST API. Show the same API used
without the UI.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | – | liveness + DB check |
| GET | `/api/stats` | – | counters for the home page |
| POST | `/api/auth/register` | – | create a user → `{ token, user }` |
| POST | `/api/auth/login` | – | get a token → `{ token, user }` |
| GET | `/api/auth/me` | Bearer | who am I? |
| GET | `/api/events?q=&category=` | – | list + search + filter |
| GET | `/api/events/categories` | – | allowed categories |
| GET | `/api/events/:id` | – | one event |
| POST | `/api/events` | Bearer | create |
| DELETE | `/api/events/:id` | Bearer, organizer only | delete |
| GET / POST | `/api/events/:id/rsvp` | Bearer | status / toggle a reservation |

Status codes worth pointing out: `201` created, `204` deleted, `400` invalid
input, `401` not authenticated, `403` authenticated but not allowed, `404`,
`409` conflict (email taken, event full).

## Easiest: `api.http`

Open [`api.http`](../api.http) in VS Code with the **REST Client** extension
(or in any JetBrains IDE) and click "Send Request" above each block. The login
request stores the token, and the protected requests reuse it. Change `@host`
to `http://<EC2_PUBLIC_IP>` to run the same calls against AWS.

## curl (bash, Git Bash, WSL)

```bash
H=http://localhost:8080/api

curl -s $H/health
curl -s "$H/events?q=docker"

TOKEN=$(curl -s -X POST $H/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"supersecret"}' | jq -r .token)

curl -s -X POST $H/events -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"API demo","description":"Created with curl","category":"Talk",
       "location":"Room 1","starts_at":"2026-12-01T10:00:00Z","capacity":10}'

curl -s -X POST $H/events -H 'Content-Type: application/json' -d '{}'   # 401 without token
```

## PowerShell

In Windows PowerShell 5.1, `curl` is an alias for `Invoke-WebRequest`. Use
`curl.exe`, or the native cmdlet:

```powershell
$H = "http://localhost:8080/api"
Invoke-RestMethod "$H/health"

$body  = @{ email = "alice@example.com"; password = "supersecret" } | ConvertTo-Json
$token = (Invoke-RestMethod "$H/auth/login" -Method Post -ContentType "application/json" -Body $body).token
Invoke-RestMethod "$H/auth/me" -Headers @{ Authorization = "Bearer $token" }
```

## Explain the token

Paste the token into <https://jwt.io>. The payload (user id, name, expiry) is
**readable by anyone**: it is signed, not encrypted. The signature only proves
that our server issued it and that nobody modified it. That's why it never
contains secrets, and why it expires after 2 hours.
