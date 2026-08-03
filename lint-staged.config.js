/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
export default {
  '*.css': ['stylelint --fix', 'prettier --write'],
  '*.{js,jsx,ts,tsx,vue}': ['eslint --fix', 'prettier --write'],
  '!(*.css|*.js|*.jsx|*.ts|*.tsx|*.vue)': ['prettier --write'],
};
