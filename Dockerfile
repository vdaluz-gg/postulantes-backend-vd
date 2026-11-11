# ---- build ----
FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app
# musl (con musl-utils, que sale del mismo origen) y zlib: los arreglos (CVE-2026-107891 y CVE-2026-4738) todavía no están en Alpine 3.24 estable, solo en edge.
# Se traen únicamente esos dos paquetes. Sacar este bloque cuando 3.24 los publique.
RUN apk add --no-cache --upgrade musl musl-utils zlib --repository=https://dl-cdn.alpinelinux.org/alpine/edge/main
# En runtime no hace falta npm, npx, corepack ni yarn (solo se ejecuta `node`): se sacan, y con ellos las
# dependencias que traen (pacote, sigstore, ip-address, picomatch y brace-expansion viejos).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/uploads && chown app:app /app/uploads
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/api/v1/health || exit 1
CMD ["node", "dist/main"]
