import { describe, expect, it } from 'vitest';

import { createSceneRepository } from '../../application/scene-repository';
import { createEmptyHistory } from '../../models/history.domain';
import type { Project } from '../../models/project.domain';
import { createProjectFileWithSources } from '../../test-utils/project-fixtures';
import { createMemoryAssetByteStore } from './asset-byte-store';
import { clearAssetSession, holdAssetBlob, peekAssetBlob, peekAssetUrl } from './asset-session';
import {
  deleteProjectWithAssets,
  hydrateProjectAssets,
  projectWithNewId,
  syncProjectAssetBytes,
} from './project-asset-sync';

const projectWithHistory = (): Project => ({
  ...createProjectFileWithSources().project,
  history: createEmptyHistory(),
});

describe('project asset bytes', () => {
  it('stores bytes on save and restores a session url on open', async () => {
    clearAssetSession();
    const project = projectWithHistory();
    const assetId = project.assets[0]!.id;
    holdAssetBlob(assetId, new Blob(['png-bytes'], { type: 'image/png' }), 'image/png');
    const byteStore = createMemoryAssetByteStore();

    await syncProjectAssetBytes(byteStore, project);
    clearAssetSession();
    expect(peekAssetUrl(assetId)).toBeUndefined();

    await hydrateProjectAssets(byteStore, project);

    expect(peekAssetBlob(assetId)?.size).toBe(new Blob(['png-bytes']).size);
    expect(peekAssetUrl(assetId)).toBeTruthy();
    clearAssetSession();
  });

  it('opens a project that has no stored bytes', async () => {
    clearAssetSession();
    const project = projectWithHistory();
    await hydrateProjectAssets(createMemoryAssetByteStore(), project);
    expect(peekAssetUrl(project.assets[0]!.id)).toBeUndefined();
  });

  it('keeps bytes already stored when the session does not hold them, and drops unused keys', async () => {
    clearAssetSession();
    const project = projectWithHistory();
    const key = project.assets[0]!.location.kind === 'storageKey' ? project.assets[0]!.location.key : '';
    const byteStore = createMemoryAssetByteStore();
    await byteStore.put({
      projectId: project.id,
      key,
      mimeType: 'image/png',
      bytes: new Blob(['kept']),
    });
    await byteStore.put({
      projectId: project.id,
      key: 'local/gone',
      mimeType: 'image/png',
      bytes: new Blob(['gone']),
    });

    await syncProjectAssetBytes(byteStore, project);

    const records = await byteStore.list(project.id);
    expect(records.map((record) => record.key)).toEqual([key]);
  });

  it('copies bytes onto a new project id and leaves the original in place', async () => {
    clearAssetSession();
    const project = projectWithHistory();
    const assetId = project.assets[0]!.id;
    holdAssetBlob(assetId, new Blob(['png-bytes'], { type: 'image/png' }), 'image/png');
    const byteStore = createMemoryAssetByteStore();
    await syncProjectAssetBytes(byteStore, project);

    const copy = projectWithNewId(project, '99999999-9999-4999-8999-999999999999', '2026-11-25T12:00:00.000Z');
    expect(copy.history.past).toEqual([]);
    await syncProjectAssetBytes(byteStore, copy);

    expect((await byteStore.list(project.id)).map((record) => record.key)).toEqual(
      (await byteStore.list(copy.id)).map((record) => record.key),
    );
    expect(copy.id).not.toBe(project.id);
    clearAssetSession();
  });

  it('deletes project bytes together with the document', async () => {
    const backendRecords = new Map<string, unknown>();
    const repository = createSceneRepository({
      async get(id) {
        return backendRecords.get(id);
      },
      async put(file) {
        backendRecords.set(file.project.id, file);
      },
      async list() {
        return [...backendRecords.values()];
      },
      async remove(id) {
        backendRecords.delete(id);
      },
    });
    const project = projectWithHistory();
    const byteStore = createMemoryAssetByteStore();
    await repository.saveProject(project);
    await byteStore.put({
      projectId: project.id,
      key: 'local/a',
      mimeType: 'image/png',
      bytes: new Blob(['a']),
    });

    const removed = await deleteProjectWithAssets(repository, byteStore, project.id);

    expect(removed.ok).toBe(true);
    expect(await byteStore.list(project.id)).toEqual([]);
    expect((await repository.loadProject(project.id)).ok).toBe(false);
  });
});
