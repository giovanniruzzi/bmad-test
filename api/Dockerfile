# syntax=docker/dockerfile:1.7

# ---- Stage 1: build TypeScript to dist/ ----
FROM node:24-alpine AS builder
WORKDIR /app

# Copy lockfile + manifest first for cache-friendly layer
COPY package.json package-lock.json ./
RUN npm ci

# Copy sources and compile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
# After this, /app/dist/server.js exists and is the entrypoint.

# ---- Stage 2: minimal runtime ----
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Production deps only — no tsx, no typescript, no @types/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Pull the compiled JS from the builder
COPY --from=builder /app/dist ./dist

# node:*-alpine ships a `node` user (UID 1000) — drop privileges
USER node

EXPOSE 3000
CMD ["node", "dist/server.js"]
