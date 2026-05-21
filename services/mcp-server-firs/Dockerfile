# syntax=docker/dockerfile:1.7
#
# Multi-stage build for @bossnyumba/mcp-server-firs (Nigeria FIRS / NRS
# tax connector). Pure Node — no AGPL deps, just a slim build + runtime.

# ---------- Stage 1: Node build (MIT) -------------------------------------
FROM node:26-bookworm-slim AS node-build

WORKDIR /build
COPY package.json tsconfig.json ./
COPY src/ ./src/

RUN npm install --no-audit --no-fund \
 && npx tsc


# ---------- Stage 2: Runtime ----------------------------------------------
FROM node:26-bookworm-slim AS runtime

WORKDIR /app

COPY --from=node-build /build/dist /app/dist
COPY --from=node-build /build/node_modules /app/node_modules
COPY package.json /app/package.json

ENV NODE_ENV=production

USER node

ENTRYPOINT ["node", "/app/dist/index.js"]
