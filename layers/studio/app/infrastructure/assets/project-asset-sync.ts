import { createEmptyHistory } from '../../models/history.domain';
import type { ProjectId } from '../../models/ids.domain';
import type { Project } from '../../models/project.domain';
import { portErr, type PortResult } from '../../ports/result';
import type { SceneRepository, SceneRepositoryError } from '../../ports/scene-repository';
import type { PackagedAsset } from '../../serialization/project-package';
import type { AssetByteStore } from './asset-byte-store';
import { clearAssetSession, holdAssetBlob, peekAssetBlob, peekAssetMimeType } from './asset-session';

const PENDING_IMAGE_KEY = 'pending/image';

/** Writes session blobs for the project's storage keys and drops bytes the document no longer uses. */
export async function syncProjectAssetBytes(byteStore: AssetByteStore, project: Project): Promise<void> {
  const keep = new Set<string>();
  for (const asset of project.assets) {
    if (asset.location.kind !== 'storageKey') {
      continue;
    }
    keep.add(asset.location.key);
    if (asset.location.key === PENDING_IMAGE_KEY) {
      continue;
    }
    const blob = peekAssetBlob(asset.id);
    if (!blob) {
      continue;
    }
    await byteStore.put({
      projectId: project.id,
      key: asset.location.key,
      mimeType: peekAssetMimeType(asset.id) || blob.type || 'application/octet-stream',
      bytes: blob,
    });
  }

  const existing = await byteStore.list(project.id);
  for (const record of existing) {
    if (!keep.has(record.key)) {
      await byteStore.remove(project.id, record.key);
    }
  }
}

/** Rebuilds session object URLs from the byte store. A missing file leaves that asset without a URL. */
export async function hydrateProjectAssets(byteStore: AssetByteStore, project: Project): Promise<void> {
  clearAssetSession();
  const records = await byteStore.list(project.id);
  const byKey = new Map(records.map((record) => [record.key, record]));
  for (const asset of project.assets) {
    if (asset.location.kind !== 'storageKey') {
      continue;
    }
    const record = byKey.get(asset.location.key);
    if (!record) {
      continue;
    }
    holdAssetBlob(asset.id, record.bytes, record.mimeType);
  }
}

export function holdPackagedAssets(project: Project, assets: PackagedAsset[]): void {
  const byKey = new Map(assets.map((asset) => [asset.key, asset]));
  for (const asset of project.assets) {
    if (asset.location.kind !== 'storageKey') {
      continue;
    }
    const packed = byKey.get(asset.location.key);
    if (!packed) {
      continue;
    }
    const bytes = packed.bytes.buffer.slice(
      packed.bytes.byteOffset,
      packed.bytes.byteOffset + packed.bytes.byteLength,
    ) as ArrayBuffer;
    holdAssetBlob(asset.id, new Blob([bytes], { type: packed.mimeType }), packed.mimeType);
  }
}

export async function collectPackageAssets(project: Project): Promise<PackagedAsset[]> {
  const assets: PackagedAsset[] = [];
  for (const asset of project.assets) {
    if (asset.location.kind !== 'storageKey' || asset.location.key === PENDING_IMAGE_KEY) {
      continue;
    }
    const blob = peekAssetBlob(asset.id);
    if (!blob) {
      continue;
    }
    assets.push({
      key: asset.location.key,
      mimeType: peekAssetMimeType(asset.id) || blob.type || 'application/octet-stream',
      bytes: new Uint8Array(await blob.arrayBuffer()),
    });
  }
  return assets;
}

/** New catalog id, same asset keys, no undo history. */
export function projectWithNewId(project: Project, id: ProjectId, updatedAt: string): Project {
  return {
    ...project,
    id,
    history: createEmptyHistory(),
    metadata: { ...project.metadata, updatedAt },
  };
}

export async function deleteProjectWithAssets(
  repository: SceneRepository,
  byteStore: AssetByteStore,
  id: ProjectId,
): Promise<PortResult<void, SceneRepositoryError>> {
  if (!repository.deleteProject) {
    return portErr({ kind: 'io', message: 'Project delete is unavailable' });
  }
  const removed = await repository.deleteProject(id);
  if (!removed.ok) {
    return removed;
  }
  await byteStore.removeProject(id);
  return removed;
}
