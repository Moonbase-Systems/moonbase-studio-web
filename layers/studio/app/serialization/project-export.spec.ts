import { describe, expect, it } from 'vitest';

import { createValidProject } from '../test-utils/project-fixtures';
import { parseProjectFile, projectExportPayload } from './project-file';

describe('projectExportPayload', () => {
  it('builds a project file download and leaves history out of the file', () => {
    const project = createValidProject();
    project.history.past.push({
      id: 'history-1',
      label: 'secret-history-marker',
      timestamp: '2026-01-01T00:00:00.000Z',
      patch: {
        forward: { document: { ...project, history: undefined } as never, activeSceneId: null, selectedElementIds: [] },
        inverse: { document: { ...project, history: undefined } as never, activeSceneId: null, selectedElementIds: [] },
      },
    });

    const payload = projectExportPayload(project);

    expect(payload.filename).toBe('Test-Project.json');
    expect(payload.body).not.toContain('secret-history-marker');
    const parsed = parseProjectFile(payload.body);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.file.project).not.toHaveProperty('history');
      expect(parsed.project.name).toBe('Test Project');
    }
  });
});
