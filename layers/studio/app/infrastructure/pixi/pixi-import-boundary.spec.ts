import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const pixiDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(pixiDir, '..', '..', '..', '..', '..');
const scannedRoots = ['app', 'layers'].map((dir) => join(repoRoot, dir));

const PIXI_IMPORT = /(?:from\s+|import\s*\(\s*)['"](?:pixi\.js|@pixi\/[^'"]*)['"]/;

const collectSourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return entry === 'node_modules' || entry.startsWith('.') ? [] : collectSourceFiles(fullPath);
    }
    return /\.(?:ts|vue)$/.test(entry) && !entry.endsWith('.spec.ts') ? [fullPath] : [];
  });

describe('PixiJS import boundary', () => {
  it('imports pixi.js only inside infrastructure/pixi', () => {
    const offenders = scannedRoots
      .flatMap(collectSourceFiles)
      .filter((file) => !file.startsWith(`${pixiDir}${sep}`))
      .filter((file) => PIXI_IMPORT.test(readFileSync(file, 'utf8')))
      .map((file) => relative(repoRoot, file));

    expect(offenders).toEqual([]);
  });

  it('the adapter itself is found by the scan pattern', () => {
    const adapter = readFileSync(join(pixiDir, 'pixi-composition-engine.ts'), 'utf8');
    expect(adapter).toMatch(PIXI_IMPORT);
  });
});
