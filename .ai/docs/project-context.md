# Project Context — moonbase-studio-web

## Overview

`moonbase-studio-web` is the frontend application of the **Moonbase** platform. It is a **Nuxt 4** SSR application written in **TypeScript**, using **Tailwind CSS** for styling and a custom **moonbase-core** Nuxt layer for shared UI components and design tokens.

The application is currently in early development (v0.1.0). The default locale is **Polish (pl)**, with English (en) support as well.

---

## Tech Stack

| Area                 | Technology                                                                 |
| -------------------- | -------------------------------------------------------------------------- |
| Framework            | Nuxt 4 (`nuxt ^4.3.1`)                                                     |
| Language             | TypeScript (strict mode)                                                   |
| Styling              | Tailwind CSS + custom design tokens                                        |
| Component library    | Custom (via `moonbase-core`) + `reka-ui`                                   |
| State management     | Pinia + `pinia-plugin-persistedstate` (stored in cookies)                  |
| Form handling        | VeeValidate + Zod                                                          |
| Routing              | `vue-router` + `nuxt-typed-router`                                         |
| Internationalisation | `@nuxtjs/i18n` (strategy: `no_prefix`, default locale: `pl`)               |
| HTTP client          | `$fetch` (via custom `$api` plugin)                                        |
| Icons                | `@nuxt/icon` with `@iconify-json/material-symbols` and `@iconify-json/mdi` |
| Images               | `@nuxt/image`                                                              |
| Security             | `nuxt-security` (enabled in non-dev environments)                          |
| Package manager      | pnpm                                                                       |
| Linting              | ESLint + Stylelint + Prettier                                              |
| Git hooks            | Husky + lint-staged + commitlint (Conventional Commits)                    |

---

## Project Structure

```
moonbase-studio-web/
├── app/                        # Main application code
│   ├── assets/                 # Static assets
│   ├── components/
│   │   └── layout/
│   │       └── DefaultLayout.vue
│   ├── composables/
│   │   └── useResponsiveI18n.ts
│   ├── constants/
│   │   └── ssr-width.ts        # SSR width hint (1920px)
│   ├── layouts/
│   │   └── default.vue         # Wraps DefaultLayout
│   ├── utils/
│   │   └── index.ts            # Re-exports cn() from core layer
│   └── app.vue                 # Root component (provideSSRWidth)
├── config/                     # Build-time config
│   ├── constants.ts            # IS_DEV, CORE_LAYER_PATH, COOKIE_MAX_AGE_DAYS
│   ├── config.utils.ts         # getFilesForLocale() helper
│   └── index.ts
├── i18n/
│   └── locales/
│       ├── pl/                 # Polish translations (default)
│       └── en/                 # English translations
├── layers/
│   ├── auth/                   # Authentication logic layer (no UI/pages yet)
│   │   ├── app/
│   │   │   ├── composables/    # useLogin.ts, useRegister.ts, useAuthRedirects.ts
│   │   │   ├── middleware/     # auth.global.ts, guest-only.global.ts
│   │   │   ├── models/         # auth-api.domain.ts, user-session.domain.ts, user.domain.ts
│   │   │   ├── schemas/        # Zod schemas (index.ts)
│   │   │   ├── services/       # auth.service.ts
│   │   │   └── store/          # user-session.store.ts (Pinia)
│   │   └── nuxt.config.ts
│   ├── studio/                 # Studio domain (models + Zod; stores TBD)
│   │   ├── app/
│   │   │   ├── models/         # Project, Scene, Source, Asset, Audio, …
│   │   │   └── schemas/        # project-file.schema.ts
│   │   └── nuxt.config.ts
│   └── core/                   # Application-level core layer
│       ├── app/
│       │   ├── composables/    # useApi.ts
│       │   ├── constants/      # async-data-keys.ts, store-keys.ts
│       │   ├── models/         # base-response.domain.ts
│       │   ├── plugins/        # api.ts ($api plugin)
│       │   └── utils/          # icons.ts (semantic icon mapping)
│       └── server/
│           └── api/
│               └── [...path].ts  # API proxy to backend
├── .ai/docs/
│   ├── architecture/           # Studio domain architecture
│   └── requirements/           # User stories
├── moonbase-core/       # Symlink/submodule to shared UI layer
├── nuxt.config.ts
├── tailwind.config.ts
└── package.json
```

Studio domain architecture: see [architecture/overview.md](./architecture/overview.md).

---

## Core Layer (`moonbase-core`)

A separate Nuxt layer (external repo: `github:Moonbase-Systems/moonbase-core`) that provides:

- **Shared UI components**: `BaseButton`, `BaseCard`, `BaseInput`, `BasePasswordInput`, `BaseFormField`, `BrandLogo`
- **Design tokens**: CSS custom properties for colors, applied via `.theme-light`, `.theme-dark`, `.theme-blue` classes
- **Tailwind config extension**: Custom spacing, font sizes, colors, border radii, transition durations
- **Global CSS**: `base.css` (fade transitions), `tailwind.css`, `tokens.css`
- **Utilities**: `cn()` (clsx + tailwind-merge with custom font-size groups), `getSemanticIconName()`

In development, resolved from the local path (`../moonbase-core` or `CORE_LAYER_PATH` env). In production, pulled directly from GitHub.

---

## API Communication

All HTTP requests go through a **server-side proxy** (`/api/[...path].ts`) that forwards to the backend (`API_BASE_URL` env). On the client, `$api` is a `$fetch` instance pointing at `/api`.

Environment variables:

- `API_BASE_URL` — private, server-side backend URL
- `PUBLIC_API_BASE_URL` — public, defaults to `/api`
- `PUBLIC_SITE_BASE_URL` — public site base URL
- `ENVIRONMENT` — `development` | `production`
- `CORE_LAYER_PATH` — override for core layer path in dev

---

## Authentication Flow

1. The `auth.global` middleware runs on routes with `meta.auth === true` or `requiredPermissions`.
2. If the user is **authenticated**, `useAuthRedirects` checks `requiredPermissions` in route meta — aborts if insufficient.
3. If the user is **unauthenticated** and the route requires auth, redirects to `/`.
4. The `guest-only.global` middleware redirects authenticated users away from guest-only routes (`meta.guestOnly === true`).
5. On login, the `useLogin` composable calls `auth.service → /auth/login`, then `/auth/me`, and stores the result in `useUserSessionStore` (persisted in cookies, 30 days).
6. On 401 responses, the `$api` plugin clears the session store and redirects to `/`.

---

## Internationalisation

- All user-facing strings must be in i18n files under `i18n/locales/{locale}/`.
- Files are auto-discovered per locale via `getFilesForLocale()`.
- The `useResponsiveI18n` composable provides `tResponsive(key)` — falls back to `{key}.mobile` on small screens.
- Validation error messages in Zod schemas use i18n keys (e.g. `'auth.validation.emailRequired'`), translated at render time in components.
