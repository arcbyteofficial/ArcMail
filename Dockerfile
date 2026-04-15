# ---- Build stage ----
FROM node:24-slim AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json package-lock.json ./

# Install ALL deps (including devDeps needed for the Vite build)
RUN npm ci

# Copy source and build the frontend
COPY . .
RUN npm run build

# Prune dev dependencies in-place so the runner stage gets a lean node_modules
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy pruned node_modules from builder (already compiled, no native rebuild needed)
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Copy built frontend assets and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

EXPOSE 3000

CMD ["node", "server/index.js"]
