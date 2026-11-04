# ----------------------
# Base stage
# ----------------------
FROM node:22-alpine AS base

ENV HUSKY=0
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install corepack for pnpm
RUN npm i -g corepack@latest \
  && corepack enable

# ----------------------
# Build stage
# ----------------------
FROM base AS build
WORKDIR /app

# Copy manifests first for caching. .npmrc must be present so hoist settings
# apply during install (otherwise TypeScript cannot resolve transitive deps).
COPY package.json pnpm-lock.yaml .npmrc ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# pnpm install above runs before the source is copied, so its postinstall
# `nuxt prepare` writes a .nuxt for an empty project. .dockerignore keeps that
# directory, and `nuxt build` typechecks against it. Remove it and prepare
# again once the source and the layer token are present.
ARG ENVIRONMENT=production
ENV ENVIRONMENT=$ENVIRONMENT

# Prefixing only the first command would leave prepare and build unauthenticated.
# A private layer then 404s. Export the token for this whole shell, not the image.
RUN --mount=type=secret,id=NUXT_LAYER_GITHUB_TOKEN \
    export NUXT_LAYER_GITHUB_TOKEN="$(cat /run/secrets/NUXT_LAYER_GITHUB_TOKEN)" && \
    rm -rf .nuxt && pnpm exec nuxt prepare && pnpm exec nuxt build

# ----------------------
# Production stage
# ----------------------
FROM base AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV ENVIRONMENT=production
ENV PORT=3000
# Bind all container interfaces; restrict exposure via the host port mapping.
ENV HOST=0.0.0.0

# Copy built files from build stage
COPY --from=build /app/.output/ ./

EXPOSE 3000

# .output/ was copied to /app, so the Nitro entrypoint is at server/index.mjs.
CMD ["node", "server/index.mjs"]

# ----------------------
# Development stage
# ----------------------
FROM base AS dev
WORKDIR /app
ENV NODE_ENV=development
ENV ENVIRONMENT=development
ENV PORT=3000
ENV HOST=0.0.0.0
ENV CORE_LAYER_PATH=./moonbase-core

# Copy dependencies only first for caching. .npmrc must be present so hoist
# settings apply during install.
COPY package.json pnpm-lock.yaml .npmrc ./

# Install all dependencies (dev + prod)
RUN pnpm install

# Copy all source code
COPY . .

EXPOSE 3000
EXPOSE 9229

CMD ["pnpm", "dev"]
