import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export const getFilesForLocale = (locale: string) => {
  return readdirSync(join(process.cwd(), 'i18n/locales', locale))
    .filter((file) => file.endsWith('.json'))
    .map((file) => join(locale, file));
};
