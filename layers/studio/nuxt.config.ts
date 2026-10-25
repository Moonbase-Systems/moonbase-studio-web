import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineNuxtConfig({
  components: [
    {
      path: resolve(currentDir, 'app/components'),
      pathPrefix: false,
      extensions: ['.vue'],
    },
  ],
});
