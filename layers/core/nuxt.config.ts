import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineNuxtConfig } from 'nuxt/config';

const currentDir = dirname(fileURLToPath(import.meta.url));

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  components: [
    {
      path: resolve(currentDir, 'app/components'),
      pathPrefix: false,
      extensions: ['.vue'],
    },
  ],
});
