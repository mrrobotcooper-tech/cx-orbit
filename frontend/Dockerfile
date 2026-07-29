# syntax=docker/dockerfile:1
# Static operator console. API calls expect a reverse-proxy for /svc/* in production.
#   docker build -f frontend/Dockerfile -t cxorbit/frontend .

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
RUN pnpm --filter @cx-orbit/frontend build

FROM nginx:1.27-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
