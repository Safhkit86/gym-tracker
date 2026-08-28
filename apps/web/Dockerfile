# syntax=docker/dockerfile:1

# Il build context e' la root del monorepo (vedi docker-compose.yml/
# docker-compose.prod.yml), necessario perche' npm workspaces risolva
# @gym-tracker/shared. Due stage finali distinti: "dev" (Vite dev server con
# hot reload, usato da docker-compose.yml) e "runtime" (nginx su build
# statica, usato da docker-compose.prod.yml) — vedi i rispettivi stage sotto.

FROM node:20-alpine AS base
WORKDIR /app

# --- Stage 1: installa tutte le dipendenze del workspace ---
FROM base AS deps
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install --workspace=@gym-tracker/shared --workspace=@gym-tracker/web --include-workspace-root

# --- Stage dev: Vite dev server con hot reload (docker-compose.yml) ---
# Codice sorgente NON copiato qui: docker-compose.yml monta l'intero
# monorepo come bind mount su /app (in scrittura, per l'hot reload), con
# volumi dedicati su node_modules/apps/web/node_modules per non far
# scomparire quelli installati qui sotto quando il bind mount li sovrascrive
# (un volume Docker nominato, al primo avvio, si inizializza copiando il
# contenuto gia' presente nell'immagine in quel path — per questo l'ordine
# delle istruzioni conta: l'installazione delle dipendenze deve avvenire
# PRIMA che il volume venga dichiarato in docker-compose.yml).
FROM deps AS dev
# --host: senza, il dev server di Vite ascolta solo su localhost DENTRO il
# container, irraggiungibile dall'host anche con la porta pubblicata.
CMD ["npm", "run", "dev", "--workspace=@gym-tracker/web", "--", "--host", "0.0.0.0"]

# --- Stage 2: build (shared prima, poi la webapp) ---
FROM base AS build
# VITE_API_BASE_URL e' una env Vite: viene "cotta" nel bundle in questo
# stage (build time), non letta a runtime dal container -- vedi
# docker-compose.prod.yml per il valore passato.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# npm non hoista tutto a livello radice per questo workspace (conflitti di
# versione con altri workspace del monorepo): alcuni pacchetti (es.
# @vitejs/plugin-react) restano annidati sotto apps/web/node_modules, quindi
# vanno copiati anche loro, non solo il node_modules di radice sopra.
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
RUN npm run build --workspace=@gym-tracker/shared
RUN npm run build --workspace=@gym-tracker/web

# --- Stage 3: immagine finale, nginx che serve solo i file statici ---
FROM nginx:alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
# "localhost" risolve prima a ::1 (IPv6) dentro il container, ma nginx.conf
# ha solo "listen 80;" (IPv4): il probe fallirebbe sempre con "Connection
# refused" su IPv6 pur essendo il server perfettamente raggiungibile su
# IPv4 -- 127.0.0.1 esplicito evita l'ambiguita' di risoluzione.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
