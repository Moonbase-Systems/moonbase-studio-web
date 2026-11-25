import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createEmptyHistory } from '../models/history.domain';
import type { Project } from '../models/project.domain';
import { createValidProject } from '../test-utils/project-fixtures';
import { serializeProjectFile } from './project-file';
import { decodeProjectPackage, encodeProjectPackage } from './project-package';

describe('project package', () => {
  it('round-trips the document and asset bytes, without history', () => {
    const project: Project = createValidProject();
    project.history.past.push({
      id: 'history-1',
      label: 'secret-history-marker',
      timestamp: project.metadata.updatedAt,
      patch: {
        forward: { document: { ...project, history: undefined } as never, activeSceneId: null, selectedElementIds: [] },
        inverse: { document: { ...project, history: undefined } as never, activeSceneId: null, selectedElementIds: [] },
      },
    });
    const body = serializeProjectFile({ ...project, history: createEmptyHistory() });
    const packed = encodeProjectPackage(body, [
      { key: 'local/hero', mimeType: 'image/png', bytes: new TextEncoder().encode('png-bytes') },
    ]);

    const decoded = decodeProjectPackage(packed);

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) {
      return;
    }
    expect(decoded.projectJson).not.toContain('secret-history-marker');
    expect(decoded.projectJson).toContain('Test Project');
    expect(decoded.assets).toEqual([
      { key: 'local/hero', mimeType: 'image/png', bytes: new TextEncoder().encode('png-bytes') },
    ]);
  });

  it('leaves a plain json export as something other than a package', () => {
    const json = new TextEncoder().encode('{"formatVersion":4}');
    expect(decodeProjectPackage(json)).toEqual({ ok: false, reason: 'not-package' });
  });
});

describe('live source restore copy', () => {
  it('tells the operator to choose the screen again', () => {
    const polish = JSON.parse(readFileSync('i18n/locales/pl/studio.json', 'utf8')) as {
      studio: { properties: { screen: { notLoaded: string } }; audio: { systemNotLoaded: string } };
    };
    const english = JSON.parse(readFileSync('i18n/locales/en/studio.json', 'utf8')) as {
      studio: { properties: { screen: { notLoaded: string } }; audio: { systemNotLoaded: string } };
    };

    expect(polish.studio.properties.screen.notLoaded).toBe('Nie udało się wczytać źródła. Wybierz ekran ponownie.');
    expect(english.studio.properties.screen.notLoaded).toBe('The source could not be loaded. Choose the screen again.');
    expect(polish.studio.audio.systemNotLoaded).toContain('Nie udało się wczytać źródła');
    expect(english.studio.audio.systemNotLoaded).toContain('could not be loaded');
  });
});
