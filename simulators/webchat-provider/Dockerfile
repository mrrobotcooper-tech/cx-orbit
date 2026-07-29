# syntax=docker/dockerfile:1
#   docker build -f simulators/webchat-provider/Dockerfile -t cxorbit/webchat-provider .

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
COPY simulators ./simulators
COPY frontend ./frontend
COPY tests ./tests
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @cx-orbit/webchat-provider build
RUN pnpm --filter @cx-orbit/webchat-provider deploy --prod /app/deploy

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/deploy ./
EXPOSE 9107
CMD ["node", "dist/index.js"]
