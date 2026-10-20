import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const studioAppDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const FORBIDDEN_IMPORT_PATTERNS = [
  /(?:^|\n)\s*import\s+.*from\s+['"]vue['"]/,
  /(?:^|\n)\s*import\s+.*from\s+['"]pinia['"]/,
  /(?:^|\n)\s*import\s+.*from\s+['"]pixi\.js['"]/,
  /(?:^|\n)\s*import\s+.*from\s+['"]@pixi\//,
  /(?:^|\n)\s*import\s+.*from\s+['"]#layers\/moonbase-core/,
  /(?:^|\n)\s*(?:const|let|var|function|class|type|interface).*\bdocument\b/,
  /(?:^|\n)\s*(?:const|let|var|function|class|type|interface).*\bwindow\b/,
  /\bHTMLVideoElement\b/,
  /\bHTMLImageElement\b/,
  /\bMediaStream\b/,
];

/** Strip block and line comments so prose does not trigger runtime-type checks. */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const collectTsFiles = (dir: string): string[] => {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (entry === 'test-utils' || entry === 'node_modules') {
        continue;
      }
      files.push(...collectTsFiles(fullPath));
      continue;
    }
    if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }

  return files;
};

describe('studio domain isolation', () => {
  it('does not import Vue, Pinia, PixiJS, DOM, or moonbase-core UI layer', () => {
    const files = collectTsFiles(studioAppDir).filter((path) => {
      return (
        path.includes(`${join('app', 'models')}`) ||
        path.includes(`${join('app', 'schemas')}`) ||
        path.includes(`${join('app', 'serialization')}`) ||
        path.includes(`${join('app', 'ports')}`)
      );
    });

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        expect(source, `${file} matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
