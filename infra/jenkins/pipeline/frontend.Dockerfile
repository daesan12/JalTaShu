FROM node:24.20.0-bookworm-slim

WORKDIR /workspace
ENV CI=true

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run lint
RUN npm run build