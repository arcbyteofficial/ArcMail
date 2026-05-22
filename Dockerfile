# Stage 1: Build the frontend
FROM node:20-alpine AS builder

# Set the working directory
WORKDIR /app

# Install dependencies for both frontend and backend
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the Vite frontend
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runner

# Set the working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5050

# Copy package files and install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend from the builder stage
COPY --from=builder /app/dist ./dist

# Copy the backend server files
COPY server ./server

# Run the Node.js application as a non-root user for security
USER node

# Expose the application port
EXPOSE 5050

# Start the application
CMD ["npm", "start"]
