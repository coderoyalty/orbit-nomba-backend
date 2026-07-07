# Base node image
FROM node:20-alpine AS base

RUN npm install -g pnpm

WORKDIR /usr/src/app

# --- Stage 1: Install Dependencies ---
FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json nest-cli.json ./
COPY prisma ./prisma/
COPY . .
RUN pnpm install --frozen-lockfile

# --- Stage 2: Builder ---
FROM dependencies AS builder

COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build both core-api and core-worker applications
RUN npx nest build core-api && npx nest build core-worker

# --- Stage 3: Production Runner ---
FROM base AS runner

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /usr/src/app/libs/database/src/generated/prisma ./libs/database/src/generated/prisma

ENV NODE_ENV=production

CMD ["node", "dist/apps/core-api/main.js"]
