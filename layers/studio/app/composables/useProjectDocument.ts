import { createSceneRepository } from '../application/scene-repository';
import { clearAssetSession } from '../infrastructure/assets/asset-session';
import { createIndexedDbAssetByteStore } from '../infrastructure/assets/indexed-db-asset-byte-store';
import {
  collectPackageAssets,
  deleteProjectWithAssets,
  holdPackagedAssets,
  hydrateProjectAssets,
  projectWithNewId,
  syncProjectAssetBytes,
} from '../infrastructure/assets/project-asset-sync';
import { createIndexedDbProjectBackend } from '../infrastructure/indexed-db-project-backend';
import type { ProjectId } from '../models/ids.domain';
import type { Project, ProjectMeta } from '../models/project.domain';
import type { SceneRepositoryError } from '../ports/scene-repository';
import { parseProjectFile, serializeProjectFile } from '../serialization/project-file';
import { decodeProjectPackage, encodeProjectPackage, projectPackageFilename } from '../serialization/project-package';
import { useStudioSessionStore } from '../store/studio-session.store';

type PendingDocumentAction = { kind: 'switch'; projectId: ProjectId } | null;

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export function useProjectDocument() {
  const store = useStudioSessionStore();
  const repository = createSceneRepository(createIndexedDbProjectBackend());
  const byteStore = createIndexedDbAssetByteStore();
  const { t } = useI18n();

  const statusMessage = ref<string | null>(null);
  const catalog = ref<ProjectMeta[]>([]);
  const confirmOpen = ref(false);
  const pendingAction = ref<PendingDocumentAction>(null);

  watch(
    () => store.isDirty,
    (dirty) => {
      if (dirty && statusMessage.value === t('studio.document.saved')) {
        statusMessage.value = null;
      }
    },
  );

  function messageFor(error: SceneRepositoryError, action: 'save' | 'open'): string {
    if (error.kind === 'validation') {
      return t('studio.document.invalidFile');
    }
    if (error.kind === 'not-found') {
      return t('studio.document.notFound');
    }
    return t(action === 'save' ? 'studio.document.saveFailed' : 'studio.document.openFailed');
  }

  async function refreshCatalog() {
    const listed = await repository.listProjects?.();
    if (!listed) {
      catalog.value = [];
      return;
    }
    if (!listed.ok) {
      statusMessage.value = messageFor(listed.error, 'open');
      catalog.value = [];
      return;
    }
    catalog.value = listed.value;
  }

  function requestSwitchProject(projectId: ProjectId) {
    if (projectId === store.project?.id) {
      return;
    }
    if (store.isDirty) {
      pendingAction.value = { kind: 'switch', projectId };
      confirmOpen.value = true;
      return;
    }
    void openProject(projectId);
  }

  function confirmDiscard() {
    const action = pendingAction.value;
    confirmOpen.value = false;
    pendingAction.value = null;
    if (action?.kind === 'switch') {
      void openProject(action.projectId);
    }
  }

  function cancelDiscard() {
    confirmOpen.value = false;
    pendingAction.value = null;
  }

  function saveBlocked(): boolean {
    if (store.audioMigrationConflicts.length > 0) {
      statusMessage.value = t('studio.audioMigration.saveBlocked');
      return true;
    }
    return false;
  }

  async function persistBytes(project: Project): Promise<boolean> {
    try {
      await syncProjectAssetBytes(byteStore, project);
      return true;
    } catch {
      statusMessage.value = t('studio.document.saveFailed');
      return false;
    }
  }

  async function openLoaded(project: Project, conflicts: Parameters<typeof store.setAudioMigrationConflicts>[0]) {
    const previous = store.project;
    try {
      await hydrateProjectAssets(byteStore, project);
    } catch {
      if (previous) {
        await hydrateProjectAssets(byteStore, previous).catch(() => undefined);
      }
      statusMessage.value = t('studio.document.openFailed');
      return;
    }

    store.setAudioMigrationConflicts(conflicts);
    const opened = store.openProject(project);
    if (!opened.ok) {
      if (previous) {
        await hydrateProjectAssets(byteStore, previous).catch(() => undefined);
      }
      statusMessage.value = t('studio.document.openFailed');
      return;
    }
    statusMessage.value = null;
  }

  async function saveProject() {
    const project = store.project;
    if (!project) {
      statusMessage.value = t('studio.document.saveFailed');
      return;
    }
    if (saveBlocked()) {
      return;
    }

    const saved = await repository.saveProject(project);
    if (!saved.ok) {
      statusMessage.value = messageFor(saved.error, 'save');
      return;
    }
    if (!(await persistBytes(project))) {
      return;
    }

    const marked = store.markSaved();
    statusMessage.value = marked.ok ? t('studio.document.saved') : t('studio.document.saveFailed');
  }

  async function saveProjectAs() {
    const project = store.project;
    if (!project || !import.meta.client) {
      statusMessage.value = t('studio.document.saveFailed');
      return;
    }
    if (saveBlocked()) {
      return;
    }

    const copy = projectWithNewId(project, crypto.randomUUID(), new Date().toISOString());
    const saved = await repository.saveProject(copy);
    if (!saved.ok) {
      statusMessage.value = messageFor(saved.error, 'save');
      return;
    }
    if (!(await persistBytes(copy))) {
      await repository.deleteProject?.(copy.id);
      return;
    }
    await openLoaded(copy, []);
    if (!statusMessage.value) {
      statusMessage.value = t('studio.document.saved');
    }
  }

  async function exportProjectFile() {
    const project = store.project;
    if (!project || !import.meta.client) {
      return;
    }
    const assets = await collectPackageAssets(project);
    const body = encodeProjectPackage(serializeProjectFile(project), assets);
    const packed = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
    downloadBlob(new Blob([packed]), projectPackageFilename(project.name));
  }

  async function projectIdTaken(id: ProjectId): Promise<boolean> {
    const listed = await repository.listProjects?.();
    if (!listed?.ok) {
      return false;
    }
    return listed.value.some((item) => item.id === id);
  }

  async function importProjectFile(file: File) {
    if (!import.meta.client) {
      return;
    }
    if (store.isDirty) {
      statusMessage.value = t('studio.document.discardMessage');
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const packaged = decodeProjectPackage(bytes);
    if (!packaged.ok && packaged.reason === 'invalid') {
      statusMessage.value = t('studio.document.invalidFile');
      return;
    }

    const parsed = parseProjectFile(packaged.ok ? packaged.projectJson : new TextDecoder().decode(bytes));
    if (!parsed.ok) {
      statusMessage.value = t('studio.document.invalidFile');
      return;
    }

    let project = parsed.project;
    if (await projectIdTaken(project.id)) {
      project = projectWithNewId(project, crypto.randomUUID(), new Date().toISOString());
    }
    const previous = store.project;
    clearAssetSession();
    holdPackagedAssets(project, packaged.ok ? packaged.assets : []);
    const saved = await repository.saveProject(project);
    if (!saved.ok) {
      if (previous) {
        await hydrateProjectAssets(byteStore, previous).catch(() => undefined);
      }
      statusMessage.value = messageFor(saved.error, 'save');
      return;
    }
    if (!(await persistBytes(project))) {
      await repository.deleteProject?.(project.id);
      if (previous) {
        await hydrateProjectAssets(byteStore, previous).catch(() => undefined);
      }
      return;
    }
    await openLoaded(project, parsed.conflicts);
  }

  async function openProject(id: ProjectId) {
    const loaded = await repository.loadProject(id);
    if (!loaded.ok) {
      statusMessage.value = messageFor(loaded.error, 'open');
      return;
    }
    await openLoaded(loaded.value.project, loaded.value.conflicts);
  }

  async function deleteProject(id: ProjectId) {
    const removed = await deleteProjectWithAssets(repository, byteStore, id);
    if (!removed.ok) {
      statusMessage.value = messageFor(removed.error, 'open');
      return;
    }
    if (store.project?.id === id) {
      store.closeProject();
    }
    await refreshCatalog();
  }

  return {
    statusMessage,
    catalog,
    confirmOpen,
    refreshCatalog,
    requestSwitchProject,
    confirmDiscard,
    cancelDiscard,
    saveProject,
    saveProjectAs,
    exportProjectFile,
    importProjectFile,
    deleteProject,
  };
}
