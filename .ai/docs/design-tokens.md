# Design Tokens — moonbase-studio-web

All design tokens are defined in `moonbase-core` and exposed as Tailwind utility classes. CSS custom properties live in `moonbase-core/app/assets/css/tokens.css`; the Tailwind extension is in `moonbase-core/tailwind.config.ts`. This app adds no token overrides.

The design source is the **MoonBase Studio Design System** (claude.ai artifact), direction **Orbit**, `tokens.json` v2. The Moonbase Commander 7" screen uses the same values (`electronics/moonbase-commander/docs/ekran-7.md`, section 2).

`1rem = 10px` (root-font-size plugin in the core layer).

---

## Theme

One dark theme, applied on `:root`, `.theme-dark` and `html[data-theme='dark']`. There is no light or blue theme.

---

## Colors

| Design system  | Tailwind class                                                         | Value                           | Use                                                     |
| -------------- | ---------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------- |
| surface        | `bg-surface`                                                           | `#050004`                       | Page and 7" screen background (~88% of a screen)        |
| panel          | `bg-surface-container`                                                 | `#121212`                       | Only overlays (menu, dialog, popover) and hardware keys |
| raised         | `bg-surface-container-high`                                            | `#1C1C1C`                       | Hover rows, unlit segments                              |
| line           | `border-line` / `bg-line`                                              | `#2A2A2A`                       | 1px block frames, dividers (decorative, 1.45:1)         |
| on-surface     | `text-on-surface`                                                      | `#FFFFFF`                       | Text, large numbers, icons                              |
| on-surface-dim | `text-on-surface-dim`                                                  | `#8A8A8A`                       | Labels, units, disabled (6.03:1 on surface)             |
| signal         | `text-accent` / `border-accent` / `bg-accent`                          | `#22FF86`                       | Live, active, selected, focus, corner brackets          |
| signal-dim     | `accent-dim`                                                           | `#18B85F`                       | Hover / pressed on signal, charge-bar head              |
| on-signal      | `text-on-accent`                                                       | `#050004`                       | Text on green fills                                     |
| warning        | `warning`                                                              | `#E6A15C`                       | Pause, limited power, thresholds                        |
| error          | `error`                                                                | `#E85D4C`                       | Stream error, lost camera, validation                   |
| info           | `info`                                                                 | `#5280EA`                       | Informational messages                                  |
| success        | `success`                                                              | `#22FF86`                       | Same as signal                                          |
| category       | `category-layout`, `category-interactive`, `category-interactive-fill` | `#00E5FF`, `#FF00CC`, `#37002C` | Element categories in the add panel and layer icons     |

Avoid opacity modifiers; disabled is `text-on-surface-dim` with a dashed border.

---

## Typography

| Class                                   | Family / weight   | Size / line height | Use                                        |
| --------------------------------------- | ----------------- | ------------------ | ------------------------------------------ |
| `text-display`                          | Space Grotesk 300 | 96 / 92, -0.03em   | Scene on air, power verdict                |
| `text-numeric-xl`                       | Space Grotesk 300 | 120 / 112          | One big number per view                    |
| `text-numeric-lg`                       | Space Grotesk 300 | 48 / 52            | Tile number, page heading                  |
| `text-title`                            | Space Grotesk 300 | 28 / 36            | View, card and dialog titles (white)       |
| `text-numeric-md`                       | Space Grotesk 300 | 20 / 24            | Transport time, large field values         |
| `text-body-lg`                          | Space Grotesk 400 | 18 / 26            | Console-distance text                      |
| `text-body-md`                          | Space Grotesk 400 | 16 / 24            | Text buttons, dialog body                  |
| `text-body-sm`                          | Space Grotesk 400 | 14 / 20            | Rows, menu items, field values             |
| `text-body-x-sm`                        | Space Grotesk 400 | 12 / 16            | Hints, errors (minimum size)               |
| `text-state`                            | Space Grotesk 700 | 14 / 20            | State values, key labels                   |
| `text-label` + `font-mono uppercase`    | Space Mono 400    | 12 / 16, 0.14em    | Labels, units, group headings, state words |
| `text-label-lg` + `font-mono uppercase` | Space Mono 400    | 14 / 20, 0.12em    | Labels at console distance                 |
| `text-brand-logo` + `font-brand`        | Lalezar 400       | 28 / 36            | MoonBase wordmark only                     |

Families: `font-sans`, `font-mono`, `font-brand`. Weights: `font-light`, `font-normal`, `font-bold`. Numbers: `tabular-nums`.

---

## Spacing and sizes

The named scale stays (`x-tiny` 2px … `xxxx-huge` 52px). Orbit uses its 4px-grid members: `tiny` 4, `xxx-sm` 8, `x-sm` 12, `md` 16, `xx-lg` 24, `xxxx-lg` 32, `xxx-huge` 48 (`x-tiny` 2 for hairline gaps).

Size tokens: `h-bar` 48 (app bar), `h-control` 32 (fields, menu items), `h-row` 28 (list rows), `size-bracket` 12 (corner bracket arm), `size-key` 128 (ScreenKey face).

---

## Radius

Every radius token is `0`. `rounded-full` only for the status dot.

---

## Components that carry the Orbit patterns

- `BaseFrame` / `BaseFrameBrackets` — 1px frame, corner brackets for the active block.
- `BaseStatusBadge` — status dot plus a mono word.
- `BasePropertyCard`, `BaseOptionGroup` — frame with brackets, mono or thin title.
- `StudioDialog` (studio layer) — dialog with four brackets, mono label, thin title, actions under a line.

---

## Transitions

| Token   | Class              | Value                          |
| ------- | ------------------ | ------------------------------ |
| Short   | `duration-short`   | 200ms (view and state changes) |
| Medium  | `duration-medium`  | 600ms                          |
| Long    | `duration-long`    | 1s                             |
| X-Long  | `duration-x-long`  | 1.5s                           |
| XX-Long | `duration-xx-long` | 2s                             |

Level meters: short attack, ~300ms decay. Power flow line: 1.2s linear.

---

## Semantic icons

Defined in `layers/core/app/utils/icons.ts`. Use `getSemanticIconName(theme, variant)`. Icon sets: `@iconify-json/material-symbols`, `@iconify-json/mdi`.
