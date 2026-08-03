# Coding Rules — moonbase-studio-web

## General

- Language: **TypeScript** in strict mode everywhere. No `any` — use `unknown` and narrow properly.
- Package manager: **pnpm only** (`preinstall` enforces this via `only-allow pnpm`).
- All commits must follow **Conventional Commits** (enforced by commitlint).
- Run `pnpm lint` before pushing. Pre-commit and pre-push hooks run automatically via Husky.

---

## TypeScript

- Enable strict mode — it is already configured in `tsconfig.json`.
- Prefer `type` over `interface` for domain models and API shapes (keep them in `*.domain.ts` files).
- Use `interface` for component props (VeeValidate / CVA convention).
- Avoid type assertions (`as`) except in well-justified cases (e.g. error narrowing).
- Never use non-null assertion (`!`) unless the value is guaranteed by surrounding logic.
- Export only what is necessary — prefer named exports.

---

## Vue / Nuxt Components

- Use `<script setup lang="ts">` — no Options API.
- `defineProps` with a TypeScript interface, `withDefaults` for defaults.
- `defineEmits` with a typed signature.
- Keep components thin: extract all business logic and form state into composables.
- Component files are named in **PascalCase** (e.g. `LoginForm.vue`).
- Page files are named in **kebab-case** as required by Nuxt file routing.
- Use `definePageMeta` at the top of page `<script setup>` for page-level metadata.

---

## Composables

- Named `useXxx.ts`, exported function named `useXxx`.
- Contain all reactive state, form logic, and side effects for their domain.
- Services (`useXxxService`) contain only pure API call functions — no reactive state.
- Composables may call services but not vice versa.

---

## Imports

- **Auto-import scanning is disabled** (`imports.scan: false`). All local code must be explicitly imported.
- Nuxt/Vue built-ins (`ref`, `computed`, `useNuxtApp`, `navigateTo`, etc.) are still available globally.
- Use `#layers/{layerName}/...` path aliases to import across layers. Example:
  ```ts
  import { useApi } from '#layers/core/app/composables/useApi';
  ```
- Import order is enforced by `eslint-plugin-simple-import-sort`. Order: built-ins → external → internal.

---

## Naming Conventions

| Item             | Convention                                       | Example                 |
| ---------------- | ------------------------------------------------ | ----------------------- |
| Vue components   | PascalCase                                       | `LoginForm.vue`         |
| Composables      | camelCase with `use` prefix                      | `useLogin.ts`           |
| Stores           | camelCase, suffix `.store.ts`                    | `user-session.store.ts` |
| Services         | camelCase, suffix `.service.ts`                  | `auth.service.ts`       |
| Domain types     | camelCase, suffix `.domain.ts`                   | `auth-api.domain.ts`    |
| Constants files  | kebab-case, suffix `.ts`                         | `store-keys.ts`         |
| i18n files       | kebab-case `.json`                               | `auth.json`             |
| Pinia store keys | SCREAMING_SNAKE_CASE in `STORE_KEYS` object      | `USER_SESSION`          |
| Async data keys  | SCREAMING_SNAKE_CASE in `ASYNC_DATA_KEYS` object | (defined in core layer) |

---

## Styling

- Use **Tailwind CSS utility classes** exclusively — no plain CSS unless unavoidable.
- Use the `cn()` utility (`clsx` + `tailwind-merge`) whenever classes need to be conditionally merged.
- Use **design tokens** (e.g. `bg-surface`, `text-on-surface`, `text-accent`) instead of hardcoded colour values.
- Use **semantic spacing tokens** (e.g. `p-md`, `gap-x-lg`) instead of hardcoded pixel/rem values.
- Responsive variants follow standard Tailwind breakpoint prefixes.
- When a component needs variants, use **CVA** (`class-variance-authority`) — see the component variant pattern.
- Avoid inline `style` attributes.

---

## Forms

- All forms use **VeeValidate** with `useForm`, `defineField`, `handleSubmit`.
- Validation schemas are defined with **Zod** and converted with `toTypedSchema` from `@vee-validate/zod`.
- Validation error message values in Zod schemas are **i18n keys**, not translated strings. Translation happens in the template: `$t(errors.field)`.
- API errors are stored in a separate `apiError` ref, displayed above the form.
- Wrap inputs in `BaseFormField` for consistent label/error rendering.

---

## Internationalisation

- Every user-visible string must be in an i18n JSON file.
- Namespace files by feature (e.g. `auth.json`, future `dashboard.json`).
- Keys are nested objects — use dot notation in templates: `$t('auth.login.title')`.
- Add keys to **both** `pl` and `en` locales simultaneously.
- Mobile-specific variants: add a `.mobile` sub-key under the same key to override on small screens (handled by `useResponsiveI18n`).

---

## State Management

- Use **Pinia setup stores** only (no option stores).
- Store keys must be registered in `STORE_KEYS` (in `layers/core/app/constants/store-keys.ts`).
- Stores that need persistence use `{ persist: true }` — this stores in cookies automatically.
- Never mutate store state directly outside the store — always call the store's action functions.

---

## Error Handling

- Use `createError` (Nuxt built-in) for page-level fatal errors (5xx).
- Use `apiError` ref pattern for non-fatal form/API errors displayed in the UI.
- The `$api` plugin handles 401 globally (logout + redirect) and 5xx (fatal error).
- Always narrow `unknown` errors before accessing properties:
  ```ts
  const error = err as { data?: { message?: string } };
  apiError.value = error?.data?.message ?? t('auth.errors.unknownError');
  ```

---

## Linting & Formatting

- **ESLint** — `@nuxt/eslint`, `eslint-plugin-security`, `eslint-plugin-simple-import-sort`, `eslint-plugin-prettier`.
- **Stylelint** — `stylelint-config-standard`, `stylelint-config-standard-vue`.
- **Prettier** — `prettier-plugin-tailwindcss` (class sorting), `prettier-plugin-sort-json` (JSON key sorting).
- All tools run on pre-commit via lint-staged.
