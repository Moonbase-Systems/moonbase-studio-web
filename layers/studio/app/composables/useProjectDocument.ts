import { createSceneRepository } from '../application/scene-repository';
import { createIndexedDbProjectBackend } from '../infrastructure/indexed-db-project-backend';
import type { ProjectId } from '../models/ids.domain';
import type { ProjectMeta } from '../models/project.domain';
import type { SceneRepositoryError } from '../ports/scene-repository';
import { projectExportPayload } from '../serialization/project-file';
import { useStudioSessionStore } from '../store/studio-session.store';

type PendingDocumentAction = { kind: 'switch'; projectId: ProjectId } | null;

export function useProjectDocument() {
  const store = useStudioSessionStore();
  const repository = createSceneRepository(createIndexedDbProjectBackend());
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

  async function saveProject() {
    const project = store.project;
    if (!project) {
      statusMessage.value = t('studio.document.saveFailed');
      return;
    }
    if (store.audioMigrationConflicts.length > 0) {
      statusMessage.value = t('studio.audioMigration.saveBlocked');
      return;
    }

    const saved = await repository.saveProject(project);
    if (!saved.ok) {
      statusMessage.value = messageFor(saved.error, 'save');
      return;
    }

    const marked = store.markSaved();
    statusMessage.value = marked.ok ? t('studio.document.saved') : t('studio.document.saveFailed');
  }

  function exportProjectFile() {
    const project = store.project;
    if (!project || !import.meta.client) {
      return;
    }
    const payload = projectExportPayload(project);
    const url = URL.createObjectURL(new Blob([payload.body], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = payload.filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function openProject(id: ProjectId) {
    const loaded = await repository.loadProject(id);
    if (!loaded.ok) {
      statusMessage.value = messageFor(loaded.error, 'open');
      return;
    }

    store.setAudioMigrationConflicts(loaded.value.conflicts);
    const opened = store.openProject(loaded.value.project);
    if (!opened.ok) {
      statusMessage.value = t('studio.document.openFailed');
      return;
    }

    statusMessage.value = null;
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
    exportProjectFile,
  };
}
