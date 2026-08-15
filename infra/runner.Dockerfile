# syntax=docker/dockerfile:1.7
#
# apps/runner — Node + @anthropic-ai/claude-agent-sdk (Part V, §3.2).
# Build context is the REPO ROOT (ADR-002 npm workspaces). See infra/web.Dockerfile for
# why both Dockerfiles live in infra/.

FROM node:22-alpine AS deps
WORKDIR /app

# git: §3.2 writes `schedule:` into frontmatter via a git commit. Installing it here rather
# than later means the capability is declared in the image, not discovered at 2am.
# ca-certificates: outbound TLS to the Anthropic API.
RUN apk add --no-cache git ca-certificates

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/runner/package.json ./apps/runner/
COPY packages/contracts/package.json ./packages/contracts/

# Full workspace install. It pulls apps/web's deps too, which makes this image larger than
# it needs to be — accepted at M0 because a partial `npm ci --workspace` against a shared
# lockfile is the kind of clever that breaks on a different npm minor. Revisit if image
# size ever costs us something real.
RUN npm ci

# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    RUNNER_PORT=8787 \
    RUNNER_HOST=0.0.0.0

# RUNNER_HOST=0.0.0.0 is the CONTAINER's interface. Host exposure is decided solely by the
# published-port bind address in infra/compose.yaml.

RUN apk add --no-cache git ca-certificates \
 && addgroup -g 1001 -S nodejs && adduser -u 1001 -S runner -G nodejs

COPY --from=deps --chown=runner:nodejs /app/node_modules ./node_modules
COPY --chown=runner:nodejs package.json ./
COPY --chown=runner:nodejs packages/contracts ./packages/contracts
COPY --chown=runner:nodejs apps/runner ./apps/runner

# The runner executes TypeScript directly via tsx rather than shipping a compiled dist.
# @agnetos/contracts is source-only (no build step) so web and runner cannot drift, and a
# transpile-on-boot server removes an entire class of build-ordering bugs at M0.
# `runner-engineer` may swap this for a real bundle at M3; nothing else depends on it.
USER runner
EXPOSE 8787

CMD ["npm", "run", "start", "--workspace=@agnetos/runner"]
