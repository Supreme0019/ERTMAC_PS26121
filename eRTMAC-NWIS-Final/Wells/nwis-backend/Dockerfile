# =============================================================================
# NWIS Backend — Dockerfile
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "src/server.js"]
