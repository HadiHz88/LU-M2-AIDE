# 7. Security considerations

Organized by layer, using the course vocabulary: authentication,
authorization, least privilege, secure communication, scanning. Each line
points to where it is done in this repo.

## Application

| Measure | Where |
|---|---|
| Passwords stored as salted **bcrypt** hashes, never in clear | `backend/src/routes/auth.js` |
| **Authentication** with short-lived JWT bearer tokens (2 h) | `backend/src/auth.js` |
| **Authorization**: only the organizer can delete an event (`403`) | `backend/src/routes/events.js` |
| Same error for "unknown email" and "wrong password" (no user enumeration) | `auth.js` route |
| **Rate limiting** on login/register (brute force) | `express-rate-limit` |
| **Parameterized SQL** everywhere (no SQL injection) | `$1, $2…` placeholders |
| Input validation, body size limit (100 kB) | routes, `express.json({ limit })` |
| Security headers (`helmet`, nginx `X-Frame-Options`, `nosniff`) | `index.js`, `nginx.conf` |
| Generic 500 errors, no stack traces leaked | error handler in `index.js` |
| App refuses to start without a strong `JWT_SECRET` | `auth.js` |

## Containers and images

| Measure | Where |
|---|---|
| Containers run as **non-root** (`node`, nginx uid 101) | both Dockerfiles |
| Multi-stage builds: no compilers, sources or npm in runtime images | both Dockerfiles |
| `.dockerignore` keeps `.env` and `.git` out of images | `*/.dockerignore` |
| Secrets come from the environment at runtime, never baked in | compose `${VAR:?}` |
| Only the frontend publishes a port; API and DB are internal | compose files |
| Vulnerability scan before publishing; base OS patched at build time | `scripts/scan.sh`, CI, `apk upgrade` |
| Pinned base image versions (`node:22-alpine`, `postgres:18-alpine`, `nginx-unprivileged:1.30-alpine`) | Dockerfiles |
| Memory limits, log rotation | `docker-compose.deploy.yml` |

## Registries

| Measure | Where |
|---|---|
| All repositories **private** | each registry's settings |
| **Tokens, not passwords**, with expiry dates | 03-registries.md |
| **Least privilege**: write token on the laptop, read-only token / deploy token on servers | 03, 04, 06 |
| `--password-stdin` (no token in shell history) | all login commands |
| `docker logout` on shared machines; know that `~/.docker/config.json` is only base64 | 03-registries.md |
| Rotate and revoke tokens after the course (and after recording a video!) | — |

## AWS

| Measure | Where |
|---|---|
| Root user: MFA, no access keys, not used day-to-day | 05-aws-foundations.md |
| Admin work through an IAM identity in a group, with MFA | 05 |
| Security group: SSH from **My IP** only; only HTTP open to the world | 06 |
| SSH key auth only (Ubuntu AMIs disable password login); the `.pem` never leaves your laptop | 06 |
| IMDSv2 required on the instance | 06 |
| **Roles instead of static credentials**: EC2 pulls from ECR with an instance role and a custom least-privilege policy | 09-bonus.md |
| Zero-spend budget; cleanup of all billable resources | 05, 06 |

## Known limitations (be honest about them)

- **No HTTPS.** Traffic to `http://<EC2_PUBLIC_IP>` is plain text, including
  passwords and tokens. In production you'd put a domain plus TLS in front: an
  Application Load Balancer with an ACM certificate, CloudFront, or Caddy/
  Let's Encrypt on the instance.
- The JWT is stored in `localStorage`, so any XSS on the page could read it.
  An `HttpOnly` cookie is the stronger alternative.
- Secrets live in a `.env` file on the server. Next step: AWS Systems Manager
  Parameter Store or Secrets Manager, read at startup through the instance role.
- SSH on port 22 is still open (to one IP). **SSM Session Manager** removes the
  need for port 22 and key files entirely.
