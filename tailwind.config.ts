import type { Config } from 'tailwindcss';

export default {
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
} satisfies Partial<Config>;
