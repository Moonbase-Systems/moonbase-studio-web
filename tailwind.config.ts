import type { Config } from 'tailwindcss';

/**
 * Fonts, colors and scales come from the moonbase-core layer (Orbit design system).
 * Keep app-level overrides out of here so the core stays the single source.
 */
export default {
  future: {
    hoverOnlyWhenSupported: true,
  },
} satisfies Partial<Config>;
