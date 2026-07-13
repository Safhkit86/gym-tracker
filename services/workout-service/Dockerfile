# syntax=docker/dockerfile:1

# Il build context e' la root del monorepo (vedi docker-compose.yml),
# necessario perche' npm workspaces risolva @gym-tracker/shared.

FROM node:20-alpine AS base
WORKDIR /app

# --- Stage 1: installa tutte le dipendenze del workspace ---
FROM base AS deps
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/workout-service/package.json services/workout-service/package.json
RUN npm install --workspace=@gym-tracker/shared --workspace=@gym-tracker/workout-service --include-workspace-root

# --- Stage 2: build TypeScript ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/workout-service services/workout-service
RUN npm run build --workspace=@gym-tracker/shared
RUN npm run build --workspace=@gym-tracker/workout-service

# --- Stage 3: immagine finale, solo runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/services/workout-service/dist ./services/workout-service/dist
COPY --from=build /app/services/workout-service/package.json ./services/workout-service/package.json

EXPOSE 4002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4002/health || exit 1

CMD ["node", "services/workout-service/dist/index.js"]
