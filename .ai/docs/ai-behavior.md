# AI Behavior Guidelines — moonbase-studio-web

This document defines how an AI assistant should behave when working on the `moonbase-studio-web` codebase. Always consult the other docs in this folder before making changes.

---

## General Principles

- Always respect the **existing patterns** — do not introduce new patterns without explicit request.
- Always **read existing files** in the relevant area before writing code.
- Never create files in `app/` or `layers/` that duplicate functionality already in `moonbase-core`.
- Always check `coding-rules.md` and `design-tokens.md` for naming and styling constraints before writing any code.

---

## When Adding a New Feature

1. Create a new Nuxt layer under `layers/{feature}/` following the existing `auth` layer structure (logic-first; add UI when needed).
2. Add a `nuxt.config.ts` in the layer with the component path resolver pattern.
3. Group code into: `composables/`, `models/`, `services/`, `store/`, `schemas/` (add `components/` and `pages/` when UI is required).
4. Register any new Pinia store key in `layers/core/app/constants/store-keys.ts`.
5. Register any new async data key in `layers/core/app/constants/async-data-keys.ts`.
6. Add i18n translation files to **both** `i18n/locales/pl/{feature}.json` and `i18n/locales/en/{feature}.json`.

For **studio domain** work, follow `.ai/docs/architecture/` (models, stores, ADRs) and `.ai/docs/requirements/user-stories.md`. Domain types live in `layers/studio/app/models/`; do not put studio business models in `moonbase-core` or `layers/core`.

---

## When Adding a New Page

- Create the page file in `layers/{feature}/app/pages/`.
- Use `definePageMeta({ title: 'i18n.key' })` at the top of `<script setup>`.
- Add `requiredPermissions` to `definePageMeta` if the page should be access-controlled.
- Pages should be thin — delegate all logic to composables.

---

## When Adding a New Component

- If it is a **shared/primitive UI component**, it belongs in `moonbase-core`, not in `moonbase-studio-web`.
- If it is **feature-specific**, place it in `layers/{feature}/app/components/`.
- If it is a **global app-level** component (e.g. layout shell), place it in `app/components/`.
- Follow the CVA variant pattern for components with style variants.
- Export the component from an `index.ts` alongside the `.vue` file.
- Use design token classes only — never hardcode colors or sizes.

---

## When Writing Styles

- Use Tailwind utility classes from `design-tokens.md`.
- Use `cn()` (imported from `~/utils/index.ts` or `#layers/core/app/utils/index`) for conditional/merged class lists.
- Never write plain CSS unless adding a global animation or something Tailwind cannot express.
- Never use arbitrary Tailwind values like `w-[123px]` — use the token scale or request a new token.

---

## When Writing API Calls

- Add the endpoint call to the relevant `useXxxService` composable.
- Define request/response types in `*.domain.ts`.
- Call the service from a feature composable (`useXxx`), not directly from a component.
- Never call `$fetch` or `useFetch` directly — always go through `useApi()`.

---

## When Writing Forms

- Use VeeValidate (`useForm`, `defineField`, `handleSubmit`) — no manual v-model + reactive validation.
- Schema: Zod + `toTypedSchema`.
- Error message values in schemas must be i18n keys (not translated text).
- Wrap inputs in `BaseFormField` for label/error display.
- Use `BaseInput` or `BasePasswordInput` for text inputs, `BaseButton` for submit.

---

## Internationalisation

- Every visible string must go through `$t()` or `useI18n().t()`.
- Add keys to both `pl` and `en` JSON files.
- Use the namespace matching the feature layer (e.g. `auth.*` for auth layer).
- Keys should be descriptive and follow the existing nesting pattern.

---

## TypeScript

- Use `unknown` instead of `any`.
- Narrow errors: `const error = err as { data?: { message?: string } }`.
- Do not use the non-null assertion operator (`!`) unless there is no other way and the value is provably non-null.
- All explicit imports are required (auto-import scanning is off for local code).

---

## What NOT to Do

- Do not add `scan: true` or re-enable auto-import scanning.
- Do not use the Options API in Vue components.
- Do not write Pinia option stores — use setup stores only.
- Do not import from a higher layer (e.g. `layers/auth` must not import from `app/`).
- Do not bypass the `$api` plugin by using `$fetch` directly in feature code.
- Do not hardcode colors, font sizes, spacing, or border radius — always use design tokens.
- Do not add dependencies without checking if an existing package already covers the need.
- Do not commit directly to `main` — always use feature branches named `feat/MB-{issue}` or similar Moonbase convention.
