# syntax=docker/dockerfile:1
# Multi-stage build for the Channel Gateway inside the pnpm monorepo.
# Built from the REPOSITORY ROOT as context:
#   docker build -f services/channel-gateway/Dockerfile -t cxorbit/channel-gateway .

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

# ---- Dependencies + build -------------------------------------------------
FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @cx-orbit/shared build \
  && pnpm --filter @cx-orbit/platform build \
  && pnpm --filter @cx-orbit/channel-gateway build
# Prune dev dependencies for a lean runtime image.
RUN pnpm --filter @cx-orbit/channel-gateway deploy --prod /app/deploy

# ---- Runtime --------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/deploy ./
EXPOSE 8080
CMD ["node", "dist/index.js"]
