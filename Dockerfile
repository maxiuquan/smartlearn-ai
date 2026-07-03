FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

RUN npm ci --workspaces --production=false

COPY . .

RUN npm run build:client && npm run build:server

FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 appgroup && adduser --system --uid 1001 appuser

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/node_modules ./node_modules

RUN npm ci --workspace=server --production

USER appuser

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "server/dist/index.js"]