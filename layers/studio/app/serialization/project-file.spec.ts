import { describe, expect, it } from 'vitest';

import { createEmptyProject } from '../models/project.domain';
import { createValidProject } from '../test-utils/project-fixtures';
import {
  CURRENT_PROJECT_FILE_FORMAT_VERSION,
  parseProjectFile,
  serializeProjectFile,
  toProjectFile,
} from './project-file';

describe('project file serialization', () => {
  it('creates a valid project via factory that round-trips through serialize/parse', () => {
    const project = createValidProject();
    const json = serializeProjectFile(project);
    const result = parseProjectFile(json);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.file.formatVersion).toBe(CURRENT_PROJECT_FILE_FORMAT_VERSION);
    expect(result.project.id).toBe(project.id);
    expect(result.project.name).toBe(project.name);
    expect(result.project.scenes).toHaveLength(1);
    expect(result.project.history.past).toEqual([]);
    expect(result.project.history.future).toEqual([]);
  });

  it('strips history when building ProjectFile', () => {
    const project = createEmptyProject({
      id: 'p1',
      name: 'With History',
      type: 'podcast',
      sceneId: 's1',
    });
    project.history.past.push({
      id: 'h1',
      label: 'move',
      timestamp: new Date().toISOString(),
      patch: { forward: {}, inverse: {} },
    });

    const file = toProjectFile(project);
    expect('history' in file.project).toBe(false);

    const parsed = parseProjectFile(file);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.project.history.past).toEqual([]);
    }
  });

  it('returns validation errors for invalid JSON payload', () => {
    const result = parseProjectFile({ formatVersion: 99, project: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('validation');
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});
