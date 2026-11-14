# Frontend image: multi-stage build.
#   Stage 1 (build): full Node toolchain compiles React into static files.
#   Stage 2 (runtime): only nginx + those static files. No Node, no source,
#   no node_modules -> smaller image, smaller attack surface.
# Build:  docker build -t campus-events-frontend ./frontend

# ---------- Stage 1: build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------- Stage 2: runtime ----------
# The "unprivileged" nginx variant runs as a non-root user, which is why it
# listens on 8080 (ports < 1024 need root). We map host port 80 -> 8080.
FROM nginxinc/nginx-unprivileged:1.30-alpine
# Base images lag behind security patches; apply them at build time
# (found with `scripts/scan.sh`). Needs root briefly, then back to nginx (101).
USER root
RUN apk upgrade --no-cache
USER 101
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
