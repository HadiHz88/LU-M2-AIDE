# Backend image: Node.js + Express REST API (multi-stage).
# Build:  docker build -t campus-events-backend ./backend

# ---------- Stage 1: install dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app
# Copy only the manifests first. This layer (and the slow `npm ci`) is cached
# and reused until package*.json changes, so code edits rebuild in seconds.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# The app needs `node`, not `npm`. npm (and its own bundled dependencies) is
# where image scanners find most CVEs in Node images, so we do not ship it.
# Also apply the latest Alpine security patches at build time.
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Do not run as root: the official node image ships an unprivileged "node" user.
USER node

EXPOSE 3000

# Docker marks the container healthy/unhealthy from this (see `docker ps`).
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Exec form: node is PID 1 and receives SIGTERM from `docker stop` directly.
CMD ["node", "src/index.js"]
