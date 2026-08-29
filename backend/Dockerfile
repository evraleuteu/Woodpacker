# syntax=docker/dockerfile:1

# ---- Stage 1: production dependency tree (cached until lockfile changes) ----
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- Stage 2: full install + Prisma generate + TypeScript build -------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate --schema prisma/schema.prisma

COPY . .
RUN npm run build

# ---- Stage 3: minimal production runtime ------------------------------------
# Assemble: prod-only node_modules + the GENERATED Prisma client from the
# build stage (.prisma contains the query engine + generated code). We do NOT
# use `npm prune` because it treats node_modules/.prisma as extraneous.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma

EXPOSE 4000
USER node
CMD ["node", "dist/main.js"]
