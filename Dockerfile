# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM deps AS build
COPY . .
ENV NODE_ENV=production
# Secrets braucht der Build nicht: src/env.js prüft Pflichtwerte erst beim Start.
RUN npm run build && npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
USER node
EXPOSE 3000
CMD ["node", "build"]
