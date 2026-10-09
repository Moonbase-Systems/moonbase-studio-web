# Architecture Patterns — mooonbase-studio-web

## Layer Architecture

The project uses **Nuxt Layers** to separate concerns across three levels:

```
moonbase-core  (external, shared UI primitives + design system)
    ↓  extends
layers/core           (app-level infrastructure: $api plugin, proxy, store keys)
    ↓  used by
layers/auth           (auth logic: store, middleware, services — no UI yet)
layers/studio         (studio domain models + Zod; ProjectStore/EditorStore TBD)
    ↓  used by
app/                  (global layouts, root composables, shared constants)
```

Studio data architecture (models, stores, diagrams, ADRs, user stories): `.ai/docs/architecture/` and `.ai/docs/requirements/user-stories.md`.

Each layer has its own `nuxt.config.ts` and its own `app/` directory following Nuxt conventions. Layers never import from a layer above them.

---

## Feature Layer Pattern

Each feature is encapsulated in its own Nuxt layer under `layers/`. A feature layer contains:

```
layers/{feature}/
├── nuxt.config.ts
└── app/
    ├── components/   # UI components specific to the feature
    ├── composables/  # Business logic composables (useXxx.ts)
    ├── middleware/   # Route middleware
    ├── models/       # TypeScript domain types (*.domain.ts)
    ├── pages/        # Nuxt pages
    ├── repository/   # (reserved) data-access objects
    ├── schemas/      # Zod validation schemas
    ├── services/     # API service functions (useXxxService)
    └── store/        # Pinia stores (*.store.ts)
```

---

## Service Pattern

API calls are wrapped in **service composables** (`useXxxService`). A service:

- Calls `useApi()` to get typed HTTP methods (`get`, `post`, `put`, `patch`, `delete`).
- Defines request/response payload types locally.
- Returns plain async functions — no reactive state.

```ts
export const useAuthService = () => {
  const { post, get } = useApi();
  const login = (payload: LoginPayload) => post<LoginApiResponse>('/auth/login', { body: payload });
  return { login };
};
```

---

## Composable Pattern (Form Logic)

Form logic lives in **form composables** (`useLogin`, `useRegister`, etc.) that:

1. Define the Zod schema and convert it with `toTypedSchema` from `@vee-validate/zod`.
2. Use `useForm` from VeeValidate to manage form state.
3. Handle submission, API calls, and error state internally.
4. Expose only what the template needs.

This keeps `.vue` files thin — they only import the composable and bind its return values.

---

## Domain Model Pattern

TypeScript types for API contracts are in `*.domain.ts` files:

- **API response types** (`*ApiResponse`) reflect the raw shape from the backend.
- **Domain types** (e.g. `LoggedInUser`) are the internal representation after mapping from API responses.

There is a deliberate mapping step in composables (e.g. `useLogin` maps `MeApiResponse` → `LoggedInUser`) so internal types are decoupled from the API contract.

---

## Store Pattern

Pinia stores follow the **Setup Store** style (function syntax):

- Defined with `defineStore(STORE_KEYS.XXX, () => { ... }, { persist: true })`.
- State via `ref()`, derived state via `computed()`, mutations as plain functions.
- Keys are centralised in `STORE_KEYS` constant.
- All stores that need persistence use `persist: true` — stored in cookies (30-day TTL, `sameSite: lax`).

```ts
export const useUserSessionStore = defineStore(
  STORE_KEYS.USER_SESSION,
  () => {
    const user = ref<LoggedInUser | undefined>(undefined);
    const isAuthenticated = computed(() => !!user.value);
    const setUser = (data: LoggedInUser) => {
      user.value = data;
    };
    const logout = () => {
      user.value = undefined;
    };
    return { user, isAuthenticated, setUser, logout };
  },
  { persist: true },
);
```

---

## API Proxy Pattern

All client requests go to `/api/*` on the Nuxt server. The catch-all route `server/api/[...path].ts` proxies them to the private `API_BASE_URL`. This hides the backend URL from the client and avoids CORS issues.

The `$api` plugin (client + server) is a `$fetch` instance with:

- `baseURL` set to `PUBLIC_API_BASE_URL` (defaults to `/api`)
- `Accept: application/json` header on every request
- Centralised 401 handling (clear session → redirect to `/`)
- Fatal error creation for 5xx responses

---

## Permission-Based Routing

Route meta supports `requiredPermissions: string[]`. The `auth.global` middleware enforces this:

- Unauthenticated users are redirected to `/` if the route requires any permissions.
- Authenticated users without all required permissions get `abortNavigation`.
- Routes without `requiredPermissions` are accessible to everyone.

To protect a page:

```ts
definePageMeta({ requiredPermissions: ['some:permission'] });
```

---

## Component Variant Pattern (CVA)

UI components use **class-variance-authority (CVA)** for variant management. Each component has an `index.ts` that exports:

1. The CVA variant function (e.g. `baseButtonVariants`).
2. The props interface (e.g. `BaseButtonProps`).
3. The component itself as a named export.

The `cn()` utility (clsx + tailwind-merge, extended for custom font-size tokens) merges classes safely.

---

## Internationalisation Pattern

- All user-visible strings are in `i18n/locales/{locale}/{namespace}.json`.
- Validation error messages inside Zod schemas are **i18n keys** (strings), translated in components via `$t(errors.field)`.
- The `useResponsiveI18n` composable provides `tResponsive(key)` which automatically falls back to `{key}.mobile` on small screens (< `md` breakpoint).

---

## Auto-Import Policy

`imports.scan: false` is set in `nuxt.config.ts` — **auto-import scanning is disabled**. All composables, utilities, and stores must be **explicitly imported** in every file that uses them. Vue and Nuxt composables (`ref`, `computed`, `useNuxtApp`, etc.) are still auto-imported by the framework.
