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
COPY services/api-gateway/package.json services/api-gateway/package.json
RUN npm install --workspace=@gym-tracker/shared --workspace=@gym-tracker/api-gateway --include-workspace-root

# --- Stage 2: build TypeScript ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY services/api-gateway services/api-gateway
RUN npm run build --workspace=@gym-tracker/shared
RUN npm run build --workspace=@gym-tracker/api-gateway

# --- Stage 3: immagine finale, solo runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=build /app/services/api-gateway/package.json ./services/api-gateway/package.json

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "services/api-gateway/dist/index.js"]
