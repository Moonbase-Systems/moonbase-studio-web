import { describe, expect, it } from 'vitest';

import type { ProjectId } from '../models/ids.domain';
import type { ProjectFile } from '../models/project.domain';
import { createValidProject } from '../test-utils/project-fixtures';
import { createSceneRepository, type ProjectFileBackend } from './scene-repository';

const createMemoryBackend = (): ProjectFileBackend & { records: Map<string, unknown> } => {
  const records = new Map<string, unknown>();
  return {
    records,
    async get(id) {
      return records.has(id) ? structuredClone(records.get(id)) : undefined;
    },
    async put(file: ProjectFile) {
      records.set(file.project.id, structuredClone(file));
    },
    async list() {
      return [...records.values()].map((value) => structuredClone(value));
    },
    async remove(id) {
      records.delete(id);
    },
  };
};

describe('createSceneRepository', () => {
  it('saves a project file without history and loads it back', async () => {
    const backend = createMemoryBackend();
    const repository = createSceneRepository(backend);
    const project = createValidProject();
    const { history: _history, ...persistable } = project;
    project.history.past.push({
      id: 'history-1',
      label: 'Edit',
      timestamp: project.metadata.updatedAt,
      patch: {
        inverse: { document: persistable, activeSceneId: null, selectedElementIds: [] },
        forward: { document: persistable, activeSceneId: null, selectedElementIds: [] },
      },
    });

    const saved = await repository.saveProject(project);
    expect(saved.ok).toBe(true);

    const stored = backend.records.get(project.id) as ProjectFile;
    expect(stored.formatVersion).toBe(2);
    expect(stored.project).not.toHaveProperty('history');

    const loaded = await repository.loadProject(project.id);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.name).toBe(project.name);
      expect(loaded.value.history.past).toEqual([]);
      expect(loaded.value.history.future).toEqual([]);
    }
  });

  it('rejects a missing project and an unsupported file', async () => {
    const backend = createMemoryBackend();
    const repository = createSceneRepository(backend);
    const missing = await repository.loadProject('missing' as ProjectId);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.kind).toBe('not-found');
    }

    backend.records.set('bad', { formatVersion: 99, project: null });
    const invalid = await repository.loadProject('bad');
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error.kind).toBe('validation');
    }
  });

  it('lists saved projects and deletes one', async () => {
    const backend = createMemoryBackend();
    const repository = createSceneRepository(backend);
    const project = createValidProject();
    await repository.saveProject(project);
    backend.records.set('bad', { formatVersion: 99, project: null });

    const listed = await repository.listProjects!();
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toEqual([
        {
          id: project.id,
          name: project.name,
          type: project.type,
          updatedAt: project.metadata.updatedAt,
        },
      ]);
    }

    const removed = await repository.deleteProject!(project.id);
    expect(removed.ok).toBe(true);
    const after = await repository.loadProject(project.id);
    expect(after.ok).toBe(false);
  });
});
