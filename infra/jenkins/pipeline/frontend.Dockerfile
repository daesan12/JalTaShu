FROM node:22.23.2-bookworm-slim

WORKDIR /workspace
ENV CI=true TZ=Asia/Seoul

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm test
RUN npm run lint
RUN npm run build
