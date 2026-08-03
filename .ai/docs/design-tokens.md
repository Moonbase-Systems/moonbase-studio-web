# Design Tokens — moonbase-studio-web

All design tokens are defined in `moonbase-core` and exposed as Tailwind utility classes. CSS custom properties live in `app/assets/css/tokens.css`. The Tailwind extension is in `tailwind.config.ts` of the core layer.

The active theme is set via a class on `<html>`: `theme-light`, `theme-dark` (default), or `theme-blue`.

---

## Themes

| Class                   | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| `theme-light` / `:root` | Light theme                                              |
| `theme-dark`            | Dark theme (default, set in core layer `nuxt.config.ts`) |
| `theme-blue`            | Dark blue-tinted theme                                   |

---

## Colors

### Surface

| Token              | Tailwind class                | Light     | Dark      | Blue      |
| ------------------ | ----------------------------- | --------- | --------- | --------- |
| Background surface | `bg-surface` / `text-surface` | `#F2F2F2` | `#0B0D11` | `#0E131B` |
| Elevated surface   | `bg-surface-container`        | `#E9E9E9` | `#14181D` | `#1D2129` |
| Inverted surface   | `bg-surface-inverted`         | `#000000` | `#E7E7E7` | `#E7E7E8` |

### Content / Text

| Token         | Tailwind class             | Light     | Dark      | Blue      |
| ------------- | -------------------------- | --------- | --------- | --------- |
| Primary text  | `text-on-surface`          | `#050315` | `#FFFFFF` | `#FFFFFF` |
| Dimmed text   | `text-on-surface-dim`      | `#5A5A5A` | `#B3B3B3` | `#B3B3B3` |
| Inverted text | `text-on-surface-inverted` | `#FFFFFF` | `#000000` | `#000000` |

### Accent

| Token          | Tailwind class                      | Light     | Dark      | Blue      |
| -------------- | ----------------------------------- | --------- | --------- | --------- |
| Primary accent | `text-accent` / `bg-accent`         | `#0072F5` | `#3B82F6` | `#00C9E4` |
| Dimmed accent  | `text-accent-dim` / `bg-accent-dim` | `#79B4EF` | `#234E94` | `#007989` |

### Semantic

| Token   | Tailwind class                | Value (all themes) |
| ------- | ----------------------------- | ------------------ |
| Info    | `text-info` / `bg-info`       | `#5280EA`          |
| Warning | `text-warning` / `bg-warning` | `#FF6A00`          |
| Error   | `text-error` / `bg-error`     | `#DC2626`          |
| Success | `text-success` / `bg-success` | `#84CC16`          |

All semantic colors also have `-container` variants (same values currently): `bg-info-container`, `bg-error-container`, etc.

All color tokens support Tailwind opacity modifier: `bg-accent/80`, `text-error/30`, etc.

---

## Typography

### Font Families

| Token   | Tailwind class | Font                                          |
| ------- | -------------- | --------------------------------------------- |
| Primary | `font-roboto`  | Roboto (400–700, preloaded from Google Fonts) |
| Brand   | `font-arlon`   | Arlon Bold (local)                            |

### Font Sizes

| Token           | Tailwind class        | Size / Line Height |
| --------------- | --------------------- | ------------------ |
| Heading X-Huge  | `text-heading-x-huge` | 6.4rem / 7.6rem    |
| Heading X-Large | `text-heading-x-lg`   | 3.6rem / 4.4rem    |
| Heading Large   | `text-heading-lg`     | 2.8rem / 3.6rem    |
| Heading Medium  | `text-heading-md`     | 2.0rem / 2.8rem    |
| Body Large      | `text-body-lg`        | 1.8rem / 2.8rem    |
| Body Medium     | `text-body-md`        | 1.6rem / 2.4rem    |
| Body Small      | `text-body-sm`        | 1.4rem / 2.0rem    |
| Body X-Small    | `text-body-x-sm`      | 1.2rem / 1.6rem    |

> Note: `1rem = 10px` due to the `root-font-size` Tailwind plugin in the core layer.

### Font Weights

| Token    | Tailwind class        |
| -------- | --------------------- |
| Regular  | `font-normal` (400)   |
| Medium   | `font-medium` (500)   |
| Semibold | `font-semibold` (600) |

### Letter Spacing

| Token    | Tailwind class   | Value    |
| -------- | ---------------- | -------- |
| X-Small  | `tracking-x-sm`  | -0.02rem |
| Small    | `tracking-sm`    | -0.01rem |
| Medium   | `tracking-md`    | 0rem     |
| Large    | `tracking-lg`    | 0rem     |
| X-Large  | `tracking-x-lg`  | +0.02rem |
| XX-Large | `tracking-xx-lg` | +0.04rem |

---

## Spacing

All spacing tokens follow a named scale. The base unit is loosely `0.2rem` at the smallest.

| Token       | Tailwind class            | Value      |
| ----------- | ------------------------- | ---------- |
| X-Tiny      | `p-x-tiny` / `gap-x-tiny` | 0.2rem     |
| Tiny        | `p-tiny`                  | 0.4rem     |
| XXXX-Small  | `p-xxxx-sm`               | 0.6rem     |
| XXX-Small   | `p-xxx-sm`                | 0.8rem     |
| XX-Small    | `p-xx-sm`                 | 1.0rem     |
| X-Small     | `p-x-sm`                  | 1.2rem     |
| Small       | `p-sm`                    | 1.4rem     |
| **Medium**  | `p-md`                    | **1.6rem** |
| Large       | `p-lg`                    | 1.8rem     |
| **X-Large** | `p-x-lg`                  | **2.0rem** |
| XX-Large    | `p-xx-lg`                 | 2.4rem     |
| XXX-Large   | `p-xxx-lg`                | 2.8rem     |
| XXXX-Large  | `p-xxxx-lg`               | 3.2rem     |
| Huge        | `p-huge`                  | 3.6rem     |
| X-Huge      | `p-x-huge`                | 4.0rem     |
| XX-Huge     | `p-xx-huge`               | 4.4rem     |
| XXX-Huge    | `p-xxx-huge`              | 4.8rem     |
| XXXX-Huge   | `p-xxxx-huge`             | 5.2rem     |

The same scale applies to all spacing utilities: `p-`, `m-`, `gap-`, `space-`, `w-`, `h-`, etc.

---

## Border Radius

| Token      | Tailwind class | Value      |
| ---------- | -------------- | ---------- |
| None       | `rounded-none` | 0rem       |
| X-Small    | `rounded-x-sm` | 0.2rem     |
| **Small**  | `rounded-sm`   | **0.4rem** |
| **Medium** | `rounded-md`   | **0.8rem** |
| Large      | `rounded-lg`   | 1.6rem     |
| Full       | `rounded-full` | 9999px     |

---

## Transition Durations

| Token   | Tailwind class     | Value |
| ------- | ------------------ | ----- |
| Short   | `duration-short`   | 200ms |
| Medium  | `duration-medium`  | 600ms |
| Long    | `duration-long`    | 1s    |
| X-Long  | `duration-x-long`  | 1.5s  |
| XX-Long | `duration-xx-long` | 2s    |

---

## Transition Easing

| Token       | Tailwind class | Cubic Bezier                     |
| ----------- | -------------- | -------------------------------- |
| Ease-in-out | `ease-in-out`  | `cubic-bezier(0.65, 0, 0.35, 1)` |
| Ease-in     | `ease-in`      | `cubic-bezier(0.4, 0, 1, 1)`     |
| Ease-out    | `ease-out`     | `cubic-bezier(0, 0, 0.2, 1)`     |

---

## Semantic Icons

Defined in `layers/core/app/utils/icons.ts`. Use `getSemanticIconName(theme, variant)`.

| Theme      | Fill icon                               | Outline icon                                    |
| ---------- | --------------------------------------- | ----------------------------------------------- |
| `success`  | `material-symbols:check-circle`         | `material-symbols:check-circle-outline-rounded` |
| `info`     | `material-symbols:info-rounded`         | `material-symbols:info-outline-rounded`         |
| `warning`  | `material-symbols:warning-rounded`      | `material-symbols:warning-outline-rounded`      |
| `error`    | `material-symbols:error-circle-rounded` | `material-symbols:error-outline-rounded`        |
| `critical` | `mdi:close-octagon`                     | `mdi:close-octagon-outline`                     |

Icon sets available: `@iconify-json/material-symbols`, `@iconify-json/mdi`.

---

## Page / Layout Transitions

The `fade` transition is defined globally in `base.css`:

- Duration: `300ms`, easing: `cubic-bezier(0.55, 0, 0.1, 1)`
- Applied to page and layout transitions (`pageTransition`, `layoutTransition` in `nuxt.config.ts`)
