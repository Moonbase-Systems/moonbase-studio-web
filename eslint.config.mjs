import { globalIgnores } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import securityPlugin from 'eslint-plugin-security';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt([
  prettierConfig,
  {
    plugins: {
      prettierPlugin,
      securityPlugin,
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      ecmaVersion: 'latest',
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'vue/no-empty-component-block': 1,
      'vue/block-order': [
        'error',
        {
          order: ['script', 'template', 'style'],
        },
      ],
    },
  },
  globalIgnores(['coverage/**']),
]);
