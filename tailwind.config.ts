import type { Config } from 'tailwindcss';

export default {
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Lalezar', 'sans-serif'],
      },
      colors: {
        'accent-alt': 'rgb(var(--color-accent-alt) / <alpha-value>)',
      },
    },
  },
} satisfies Partial<Config>;
