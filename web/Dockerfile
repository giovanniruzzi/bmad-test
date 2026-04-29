# syntax=docker/dockerfile:1.7

# ---- Stage 1: build the Vite app ----
FROM node:24-alpine AS builder
WORKDIR /app

# Lockfile + manifest first for layer caching
COPY web/package.json web/package-lock.json ./
RUN npm ci

# Project sources + configs needed for `tsc -b && vite build`
COPY web/tsconfig.json web/tsconfig.app.json web/tsconfig.node.json ./
COPY web/vite.config.ts ./
COPY web/index.html ./
COPY web/public ./public
COPY web/src ./src
RUN npm run build
# After this, /app/dist/index.html and /app/dist/assets/* exist.

# ---- Stage 2: Caddy serving the static dist + reverse-proxying /api ----
FROM caddy:2-alpine AS runtime

# Static site root expected by the Caddyfile
COPY --from=builder /app/dist /srv

# Reverse-proxy + auto-TLS config
COPY Caddyfile /etc/caddy/Caddyfile
