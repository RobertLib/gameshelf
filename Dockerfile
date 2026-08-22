# syntax=docker/dockerfile:1
#
# GameShelf as a single deployable unit: the API and the built React app run in
# one process on one port.
#
#   docker build -t gameshelf .
#   docker run -p 3000:3000 -v gameshelf-data:/app/var \
#     -e JWT_ACCESS_SECRET="$(openssl rand -base64 48)" gameshelf

# --- 1) Dependencies --------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app

# In a debian-slim image Prisma needs OpenSSL for its query engine.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# The manifests first - the node_modules layer is then reused until the
# dependencies change.
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

# --- 2) Build ---------------------------------------------------------------
FROM deps AS build
WORKDIR /app
COPY . .

# The order is binding: the contracts are an input for both applications.
RUN npm run build --workspace @gameshelf/contracts \
 && npm run build --workspace @gameshelf/web \
 && npm run build --workspace @gameshelf/api

# Source maps have no business lying around in the image: the API serves the
# whole `dist`, so they could be downloaded at the bundle's address with a `.map`
# suffix (`sourcemap: 'hidden'` only hides the reference, it still writes the
# file). For tracking an error down from a stack trace they stay where the build
# happened. The API refuses to serve them too; this is the second safety net -
# and two megabytes off the image.
RUN find apps/web/dist -name '*.map' -delete

# A production dependency tree without the dev packages. The Prisma client is
# generated only after pruning - `npm prune` could judge the generated
# `node_modules/.prisma` superfluous and delete it.
RUN npm prune --omit=dev \
 && npm exec --workspace @gameshelf/api -- prisma generate

# --- 3) Runtime -------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    SERVE_WEB=true \
    WEB_DIST_PATH=/app/apps/web/dist \
    UPLOADS_DIR=/app/var/uploads \
    DATABASE_URL=file:/app/var/gameshelf.db \
    COOKIE_SECURE=true

# The whole pruned tree is copied at once. Listing individual directories would
# be leaner, but in an npm workspace `apps/*/node_modules` may not exist at all
# depending on the situation (most packages are hoisted to the root) and COPY
# would fail on a missing path.
COPY --from=build /app /app
COPY docker-entrypoint.sh /usr/local/bin/

# The data (SQLite + uploaded images) belongs in a volume, not in an image layer.
RUN mkdir -p /app/var/uploads \
 && chown -R node:node /app/var \
 && chmod +x /usr/local/bin/docker-entrypoint.sh

VOLUME ["/app/var"]
USER node
WORKDIR /app/apps/api
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
