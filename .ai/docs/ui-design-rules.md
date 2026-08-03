# UI Design Rules

This document defines strict UI and frontend design rules for the Moonbase ecosystem.
It applies to both `moonbase-core` and `moonbase-studio-web`.
All developers and AI agents working on UI code must follow these rules without exception.

---

## 1. Design Philosophy

Moonbase UI must be **modern, clean, and minimal**. Every visual decision must serve a functional purpose.

- The interface must feel purposeful: no decorative elements without UX value.
- Design must reflect the domain — a professional, technical platform with a dark-first aesthetic.
- Usability and clarity are non-negotiable; visual flair is secondary.
- Performance must never be sacrificed for cosmetic effects.
- Consistency and predictability take priority over novelty.
- When in doubt, do less. Simpler is always safer.

---

## 2. Design Consistency

Inconsistent UI is a defect. Visual and behavioral patterns must be uniform across the entire product.

- Reuse existing components before building new ones.
- Do not introduce new visual styles if an equivalent already exists in the system.
- Spacing, typography, colors, and border radii must always come from defined design tokens — never invented ad hoc.
- Interactive states must be consistent:
  - `hover` — visible, subtle feedback
  - `focus` — clearly visible focus ring (never removed, only styled)
  - `active` / `pressed` — immediate visual response
  - `disabled` — reduced opacity, no pointer events, cursor `not-allowed`
- Do not mix token-based values with hardcoded values within the same component.

---

## 3. TailwindCSS Usage

Tailwind is the **only** permitted styling system. All visual output must be expressed through utility classes derived from the project's token configuration.

### General Rules

- Always prefer Tailwind utility classes over custom CSS.
- Never use arbitrary values (e.g. `w-[347px]`, `text-[13px]`) when a design token exists.
- Never write inline `style` attributes for visual properties.
- Prefer semantic component abstractions over long class strings in templates.
- For variant-heavy components, use **CVA** (`class-variance-authority`) with `cn()` (`clsx` + `tailwind-merge`) — follow existing patterns in core layer components.

### Spacing

- Use the named spacing scale exclusively: `p-x-tiny`, `p-tiny`, `p-xx-sm`, `p-x-sm`, `p-sm`, `p-md`, `p-lg`, `p-x-lg`, `p-xx-lg`, `p-xxx-lg`, etc.
- The same scale applies to `m-`, `gap-`, `space-`, `w-`, `h-`.
- Do not use default Tailwind spacing numerics (e.g. `p-4`, `gap-2`) — they are overridden by the project scale.
- `1rem = 10px` in this project due to the `root-font-size` plugin.

### Typography

- Use the semantic font size scale: `text-heading-x-huge`, `text-heading-x-lg`, `text-heading-lg`, `text-heading-md`, `text-body-lg`, `text-body-md`, `text-body-sm`, `text-body-x-sm`.
- Font families: `font-roboto` for all UI text; `font-arlon` for brand/logo elements only.
- Font weights: `font-normal` (400), `font-medium` (500), `font-semibold` (600).
- Letter spacing: use `tracking-x-sm` through `tracking-xx-lg` from the defined scale.
- Never hardcode `font-size`, `line-height`, or `font-family` values.

### Color Usage

- Use semantic color tokens only. Never use Tailwind's default palette (e.g. `bg-blue-500`).
- Surface colors: `bg-surface`, `bg-surface-container`, `bg-surface-inverted`.
- Text colors: `text-on-surface`, `text-on-surface-dim`, `text-on-surface-inverted`.
- Accent: `bg-accent`, `text-accent`, `bg-accent-dim`, `text-accent-dim`.
- Semantic: `bg-info`, `bg-warning`, `bg-error`, `bg-success` (and their `-container` variants).
- Opacity modifiers are allowed: `bg-accent/80`, `text-error/30`.
- Theme is applied via `theme-light`, `theme-dark`, or `theme-blue` on `<html>` — do not override theme-sensitive tokens per component.

### Border Radius

- Use the defined scale: `rounded-none`, `rounded-x-sm`, `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-full`.
- Do not use Tailwind's default radius values (e.g. `rounded`, `rounded-2xl`).

### Transitions

- Durations: `duration-short` (200ms), `duration-medium` (600ms), `duration-long` (1s), `duration-x-long` (1.5s), `duration-xx-long` (2s).
- Easing: `ease-in-out`, `ease-in`, `ease-out` (project-defined cubic bezier values).
- Do not hardcode `transition-duration` or `transition-timing-function` values.

### Breakpoints

- Use Tailwind's standard responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`, `2xl:`.
- Apply a **mobile-first** approach: base styles target small screens, breakpoint prefixes add larger-screen overrides.
- Never use non-standard breakpoints or media query hacks.

### Layout Utilities

- Prefer `flex` and `grid` utilities for all layout.
- Use `gap-{token}` for spacing between items instead of margins where possible.
- Use `container` with responsive padding for page-level constraints.

---

## 4. Modern HTML & Layout Practices

All layouts must use modern CSS techniques. Legacy layout patterns are not permitted.

### Layout Model

- **Flexbox** (`flex`, `flex-col`, `items-*`, `justify-*`) for one-dimensional layouts (rows, stacks, navigation bars).
- **CSS Grid** (`grid`, `grid-cols-*`, `col-span-*`) for two-dimensional layouts (page grids, card grids, dashboards).
- Never use `float`, `table-layout`, or `position`-based layout hacks.

### Responsive Design

- All layouts must be fully responsive by default.
- Mobile-first: design the smallest viewport first, then add breakpoint overrides.
- Never build desktop-only layouts that fall apart on smaller screens.
- Test layouts at `sm` (640px), `md` (768px), `lg` (1024px), and `xl` (1280px) breakpoints at minimum.

### Semantic HTML

- Use semantic elements whenever applicable: `<header>`, `<main>`, `<footer>`, `<nav>`, `<section>`, `<article>`, `<aside>`, `<ul>`, `<ol>`, `<li>`, `<button>`, `<form>`, `<label>`, `<input>`.
- Never use `<div>` or `<span>` for elements that have a meaningful semantic equivalent.
- Do not use `<table>` for non-tabular data.
- Interactive elements must be native interactive elements (`<button>`, `<a>`, `<input>`) — not `<div>` or `<span>` with click handlers.

### Examples

Grid layout:

```html
<div class="gap-x-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">...</div>
```

Flex layout:

```html
<div class="gap-md flex items-center justify-between">...</div>
```

Responsive container:

```html
<main class="px-md lg:px-x-lg container mx-auto">...</main>
```

---

## 5. Component Architecture

All UI must be expressed through reusable, composable components. Inline UI logic written directly in pages or layouts is not acceptable.

### Rules

- Every piece of recurring UI must be extracted into a component.
- Components must be composable — they must accept slots, props, and emit events predictably.
- Prefer small, focused components over large monolithic ones.
- Separate **layout components** (responsible for structure and spacing) from **UI primitives** (buttons, inputs, labels).
- Components must not contain business logic — keep them presentational.
- Avoid prop drilling beyond two levels; use slots or composables to pass state down.

### Component Qualities

Every component must be:

- **Reusable** — works across multiple contexts without modification.
- **Composable** — accepts slots and forwards props where appropriate.
- **Predictable** — same props always produce the same output.
- **Testable** — has a clear API with no hidden side effects.
- **Framework idiomatic** — written in idiomatic Vue 3 using `<script setup lang="ts">`.

### File Structure (core layer)

```text
app/components/{component-name}/
├── ComponentName.vue   # Component implementation
└── index.ts            # Re-exports component and typed APIs
```

---

## 6. Core Layer Components

Shared UI primitives must **always** live in `moonbase-core`. No exceptions.

### What Belongs in the Core Layer

- `BaseButton` — all button variants
- `BaseInput` — text input
- `BasePasswordInput` — password input with toggle
- `BaseFormField` — label + input + validation wrapper
- `BaseCard` — surface container card
- `BrandLogo` — logotype
- Any future form primitives, layout primitives, or display primitives used in more than one application

### Rules

- Never duplicate a core component inside `moonbase-studio-web` or any consumer app.
- Extend via **composition** (slots, wrappers, additional props) — never by rewriting.
- When a shared component requires new behavior, add it to the core layer component and surface it via a new prop or slot.
- Any API change to a core component (props, emits, slots) is a **compatibility-sensitive change** — it can affect all consuming apps. Treat it accordingly.
- Core components must remain generic and domain-agnostic; they must not contain feature-specific logic or copy.

---

## 7. Accessibility (a11y)

Accessibility is a mandatory requirement, not an optional enhancement. Inaccessible UI is a defect.

### Interactive Elements

- All interactive elements must be operable by keyboard (Tab, Enter, Space, Escape where appropriate).
- Never suppress focus outlines; style them using `focus:ring-*` or `focus-visible:ring-*` Tailwind utilities.
- Interactive `<div>` or `<span>` elements are forbidden — use `<button>` or `<a>` instead.

### ARIA

- Add `aria-label` or `aria-labelledby` to all interactive elements that lack visible text labels.
- Use `aria-describedby` to associate error messages and hints with inputs.
- Use `role` attributes only when native semantic HTML cannot convey the intended role.
- Use `aria-live` regions for dynamic content that updates without a page reload.
- Do not add unnecessary or redundant ARIA attributes that duplicate native semantics.

### Forms

- Every `<input>`, `<select>`, and `<textarea>` must have an associated `<label>` (via `for`/`id` or wrapping).
- Error messages must be programmatically associated with their input via `aria-describedby`.
- Required fields must be indicated both visually and via `aria-required="true"` or `required`.

### Focus Management

- Modals and dialogs must trap focus while open (handled by `reka-ui` primitives where used).
- On modal close, focus must return to the triggering element.
- Avoid focus jumps that disorient keyboard users.

### Screen Reader Compatibility

- Content visible only to screen readers must use `sr-only` (Tailwind utility), not `display: none`.
- Decorative images must have `alt=""`. Informative images must have descriptive `alt` text.
- Icon-only buttons must have an `aria-label`.

### Color Contrast

- Text on backgrounds must meet WCAG 2.1 AA minimum: **4.5:1** for normal text, **3:1** for large text.
- Do not rely on color alone to convey state or meaning.

---

## 8. Internationalization (i18n)

The application supports **Polish (pl)** as the default locale and **English (en)** as a secondary locale. All user-facing text must be internationalization-ready from the start.

### Rules

- **No hardcoded user-facing strings** in templates, components, scripts, or Zod schema messages.
- All strings must be placed in `i18n/locales/{locale}/{feature}.json` and accessed via `$t()` / `useI18n()`.
- Zod validation messages must use i18n keys resolved at render time — not hardcoded strings.
- Layouts must not break with longer translated strings — avoid fixed widths on text containers.
- Use `tResponsive()` from `useResponsiveI18n` for strings that have mobile-specific variants.
- Translation keys must be namespaced by feature (e.g. `auth.login.title`, `auth.validation.emailRequired`).
- Do not use translation keys as fallback display text; always provide proper translations for all supported locales.

---

## 9. Performance Considerations

UI performance directly impacts user experience. Avoidable slowness is a defect.

### DOM

- Avoid unnecessary DOM nesting — every wrapper element must serve a layout or semantic purpose.
- Do not render hidden content that is not needed until it becomes visible (use `v-if` over `v-show` for initially hidden content that is rarely shown).

### Rendering

- Minimize reactive state that triggers wide component re-renders.
- Avoid placing expensive computed values inside templates directly; extract them into `computed` properties.
- Do not use `watch` where a `computed` is sufficient.

### Dependencies

- Do not introduce heavy UI libraries for functionality already covered by the core layer or `reka-ui`.
- Every new dependency must justify its bundle size impact.
- Lazy-load page-level components and heavy feature components using Nuxt's async component support.

### Assets

- Use `@nuxt/image` for all image rendering — never raw `<img>` tags for app images.
- Fonts are managed by `@nuxt/fonts` / `@nuxtjs/google-fonts` — do not add manual `@font-face` declarations.

---

## 10. Anti-Patterns

The following are prohibited in this codebase. Any occurrence is a defect to be corrected.

| Anti-Pattern                                    | Why It Is Prohibited                                 |
| ----------------------------------------------- | ---------------------------------------------------- |
| Duplicated UI components                        | Breaks consistency, increases maintenance burden     |
| Arbitrary Tailwind values (`w-[347px]`)         | Bypasses the design token system                     |
| Inline `style` attributes                       | Untrackable, bypasses token system, hard to maintain |
| Non-semantic HTML (`<div>` as button)           | Breaks accessibility and screen reader support       |
| Inaccessible interactive elements               | Violates a11y requirements                           |
| Hardcoded user-facing strings                   | Breaks i18n, cannot be translated                    |
| Default Tailwind palette colors (`bg-blue-500`) | Bypasses theming and token system                    |
| Feature logic in core layer components          | Violates layer boundary — core is presentation only  |
| Business logic in presentational components     | Violates component architecture rules                |
| Deeply nested component hierarchies             | Causes performance issues and readability problems   |
| Direct `<img>` tags for app images              | Bypasses `@nuxt/image` optimization                  |
| `display: none` for sr-only content             | Use `sr-only` utility instead                        |
| Removing focus outlines without a replacement   | Breaks keyboard accessibility                        |
| Hardcoded colors or spacing in `<style>` blocks | Must use tokens via Tailwind or CSS variables        |

---

## 11. Checklist for New UI

Before committing any UI code, verify all of the following:

### Design Token Compliance

- [ ] All colors use semantic token classes (`bg-surface`, `text-on-surface`, `bg-accent`, etc.)
- [ ] All spacing uses named token classes (`p-md`, `gap-x-lg`, etc.)
- [ ] All typography uses semantic size classes (`text-body-md`, `text-heading-lg`, etc.)
- [ ] No arbitrary Tailwind values used
- [ ] No inline styles for visual properties

### Component Architecture

- [ ] New UI is extracted into a reusable component (no inline template walls)
- [ ] Core layer components are used where applicable — not reimplemented
- [ ] Component is presentational, no business logic inside
- [ ] Composition pattern is followed (slots, props, emits)

### Accessibility

- [ ] All interactive elements are keyboard accessible
- [ ] Focus states are visible and styled
- [ ] All inputs have associated labels
- [ ] Icon-only buttons have `aria-label`
- [ ] ARIA attributes are correct and not redundant
- [ ] Color contrast meets WCAG AA minimum

### Layout & Responsiveness

- [ ] Layout uses Flexbox or Grid — no legacy patterns
- [ ] Mobile-first responsive styles applied
- [ ] Layout tested at `sm`, `md`, `lg`, `xl` breakpoints
- [ ] No fixed widths that break on smaller screens or with longer translations

### Internationalization

- [ ] No hardcoded user-facing strings in templates or scripts
- [ ] All strings are in the appropriate `i18n/locales/{locale}/` file
- [ ] Zod validation messages use i18n keys
- [ ] Layout accommodates variable-length translated text

### Code Quality

- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm typecheck` passes with no errors
- [ ] No `any` types introduced
- [ ] No `console.log` left in code
