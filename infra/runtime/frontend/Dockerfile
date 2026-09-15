FROM node:22.23.2-bookworm-slim AS builder

WORKDIR /workspace

ARG FRONTEND_API_PATH=/api
ARG FRONTEND_LOGIN_PATH=/auth
ARG FRONTEND_BASE_PATH=/
ARG FRONTEND_MAP_CLIENT_ID=
ARG FRONTEND_ENABLE_MSW=false

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN VITE_API_BASE_URL="${FRONTEND_API_PATH}" \
    VITE_AUTH_BASE_URL="${FRONTEND_LOGIN_PATH}" \
    VITE_BASE_PATH="${FRONTEND_BASE_PATH}" \
    VITE_NAVER_MAP_CLIENT_ID="${FRONTEND_MAP_CLIENT_ID}" \
    VITE_ENABLE_MSW="${FRONTEND_ENABLE_MSW}" \
    npm run build

FROM nginxinc/nginx-unprivileged:1.28.0-alpine

COPY --chown=101:101 infra/runtime/frontend/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=101:101 /workspace/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
