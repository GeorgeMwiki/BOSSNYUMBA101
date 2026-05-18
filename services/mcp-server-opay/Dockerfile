# syntax=docker/dockerfile:1.7
#
# Multi-stage build for @bossnyumba/mcp-server-opay. Pure Node, no AGPL.

FROM node:20-bookworm-slim AS node-build
WORKDIR /build
COPY package.json tsconfig.json ./
COPY src/ ./src/
RUN npm install --no-audit --no-fund && npx tsc

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
COPY --from=node-build /build/dist /app/dist
COPY --from=node-build /build/node_modules /app/node_modules
COPY package.json /app/package.json
ENV NODE_ENV=production
USER node
ENTRYPOINT ["node", "/app/dist/index.js"]
