import { createSceneRepository } from '../application/scene-repository';
import { createIndexedDbProjectBackend } from '../infrastructure/indexed-db-project-backend';
import type { ProjectId } from '../models/ids.domain';
import type { ProjectMeta } from '../models/project.domain';
import type { SceneRepositoryError } from '../ports/scene-repository';
import { useStudioSessionStore } from '../store/studio-session.store';

export function useProjectDocument() {
  const store = useStudioSessionStore();
  const repository = createSceneRepository(createIndexedDbProjectBackend());
  const { t } = useI18n();

  const statusMessage = ref<string | null>(null);
  const catalog = ref<ProjectMeta[]>([]);
  const catalogOpen = ref(false);
  const confirmOpen = ref(false);
  const pendingAction = ref<'new' | 'open' | null>(null);

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

  function createNewProject() {
    const created = store.createProject({ name: 'MoonBase' });
    if (!created.ok) {
      statusMessage.value = t('studio.document.createFailed');
      return;
    }
    statusMessage.value = null;
  }

  async function openCatalog() {
    await refreshCatalog();
    catalogOpen.value = true;
  }

  function requestNewProject() {
    if (store.isDirty) {
      pendingAction.value = 'new';
      confirmOpen.value = true;
      return;
    }
    createNewProject();
  }

  function requestOpen() {
    if (store.isDirty) {
      pendingAction.value = 'open';
      confirmOpen.value = true;
      return;
    }
    void openCatalog();
  }

  function confirmDiscard() {
    const action = pendingAction.value;
    confirmOpen.value = false;
    pendingAction.value = null;
    if (action === 'new') {
      createNewProject();
      return;
    }
    if (action === 'open') {
      void openCatalog();
    }
  }

  async function saveProject() {
    const project = store.project;
    if (!project) {
      statusMessage.value = t('studio.document.saveFailed');
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

  async function openProject(id: ProjectId) {
    const loaded = await repository.loadProject(id);
    if (!loaded.ok) {
      statusMessage.value = messageFor(loaded.error, 'open');
      return;
    }

    const opened = store.openProject(loaded.value);
    if (!opened.ok) {
      statusMessage.value = t('studio.document.openFailed');
      return;
    }

    catalogOpen.value = false;
    statusMessage.value = null;
  }

  return {
    statusMessage,
    catalog,
    catalogOpen,
    confirmOpen,
    requestNewProject,
    requestOpen,
    confirmDiscard,
    saveProject,
    openProject,
  };
}
