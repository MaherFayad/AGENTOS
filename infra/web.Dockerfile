# syntax=docker/dockerfile:1.7
#
# apps/web — Next.js 15 (Part V).
#
# WHY IT LIVES IN infra/ : both Dockerfiles sit here, next to the compose file that is the
# only thing that builds them. ADR-002 puts the npm workspaces root at the repo root, so
# the build context is the REPO ROOT (see `context: ..` in infra/compose.yaml) and a
# Dockerfile beside its app would still have to reach up two levels. Keeping them together
# means "everything that defines how this runs is in infra/".

# ---------------------------------------------------------------------------
# deps — resolved from the root lockfile only, so this layer caches across source edits.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/runner/package.json ./apps/runner/
COPY packages/contracts/package.json ./packages/contracts/
RUN npm ci

# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app ./
COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web

RUN npm run build --workspace=@agnetos/web

# ---------------------------------------------------------------------------
# runtime — Next standalone output; carries its own traced node_modules, so nothing
# depends on the build machine (portability constraint, Part V).
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# HOSTNAME=0.0.0.0 is the CONTAINER's interface, not the host's. Host exposure is decided
# solely by the published-port bind address in infra/compose.yaml.

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
