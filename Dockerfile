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

# ---- Runtime stage ----
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only copy what the server needs at runtime
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend assets and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

EXPOSE 3000

CMD ["node", "server/index.js"]
