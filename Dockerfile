# ----------------------
# Base stage
# ----------------------
FROM node:22-alpine AS base

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

# Copy lockfile first for caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the app
RUN pnpm run build

# ----------------------
# Production stage
# ----------------------
FROM base AS prod
WORKDIR /app
ENV ENVIRONMENT=production
ENV PORT=3000
ENV HOST=127.0.0.1

# Copy built files from build stage
COPY --from=build /app/.output/ ./

EXPOSE 3000

CMD ["pnpm", "start"]

# ----------------------
# Development stage
# ----------------------
FROM base AS dev
WORKDIR /app
ENV ENVIRONMENT=development
ENV PORT=3000
ENV HOST=0.0.0.0
ENV CORE_LAYER_PATH=./moonbase-core

# Copy dependencies only first for caching
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (dev + prod)
RUN pnpm install

# Copy all source code
COPY . .

EXPOSE 3000
EXPOSE 9229

CMD ["pnpm", "dev"]
