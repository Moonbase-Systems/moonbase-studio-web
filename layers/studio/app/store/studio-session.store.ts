import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';

import { STORE_KEYS } from '../../../core/app/constants/store-keys';
import type { LayerUpdateChanges } from '../application/commands/layer-commands';
import type { SourceDefinition } from '../application/commands/source-commands';
import { createEmptyStudioSession, getActiveScene, getSelectedLayerId } from '../application/session';
import { createStudioService } from '../application/studio.service';
import type { ElementId, SceneId, SourceId } from '../models/ids.domain';
import type { Project, ProjectType } from '../models/project.domain';

export const useStudioSessionStore = defineStore(STORE_KEYS.STUDIO_SESSION, () => {
  const sessionRef = shallowRef(createEmptyStudioSession());

  const service = createStudioService({
    state: {
      get: () => sessionRef.value,
      set: (next) => {
        sessionRef.value = next;
      },
    },
  });

  const project = computed(() => sessionRef.value.project);
  const activeSceneId = computed(() => sessionRef.value.editor.activeSceneId);
  const activeScene = computed(() => getActiveScene(sessionRef.value));
  const selectedLayerId = computed(() => getSelectedLayerId(sessionRef.value));
  const isDirty = computed(() => sessionRef.value.isDirty);
  const isInitialized = computed(() => sessionRef.value.isInitialized);

  return {
    sessionRef,
    project,
    activeSceneId,
    activeScene,
    selectedLayerId,
    isDirty,
    isInitialized,
    initialize: () => service.initialize(),
    createProject: (input?: { name?: string; type?: ProjectType }) => service.createProject(input),
    openProject: (project: Project) => service.openProject(project),
    closeProject: () => service.closeProject(),
    markSaved: () => service.markSaved(),
    setActiveScene: (sceneId: SceneId) => service.setActiveScene(sceneId),
    selectLayer: (layerId: ElementId) => service.selectLayer(layerId),
    clearSelection: () => service.clearSelection(),
    createScene: (name?: string) => service.createScene(name),
    renameScene: (sceneId: SceneId, name: string) => service.renameScene(sceneId, name),
    duplicateScene: (sceneId: SceneId) => service.duplicateScene(sceneId),
    deleteScene: (sceneId: SceneId) => service.deleteScene(sceneId),
    addLayer: (
      sceneId: SceneId,
      sourceId: SourceId,
      options?: {
        name?: string;
        transform?: LayerUpdateChanges['transform'];
        appearance?: LayerUpdateChanges['appearance'];
      },
    ) => service.addLayer(sceneId, sourceId, options),
    removeLayer: (sceneId: SceneId, layerId: ElementId) => service.removeLayer(sceneId, layerId),
    renameLayer: (sceneId: SceneId, layerId: ElementId, name: string) => service.renameLayer(sceneId, layerId, name),
    duplicateLayer: (sceneId: SceneId, layerId: ElementId) => service.duplicateLayer(sceneId, layerId),
    updateLayer: (sceneId: SceneId, layerId: ElementId, changes: LayerUpdateChanges) =>
      service.updateLayer(sceneId, layerId, changes),
    moveLayer: (sceneId: SceneId, layerId: ElementId, targetIndex: number) =>
      service.moveLayer(sceneId, layerId, targetIndex),
    setLayerVisibility: (sceneId: SceneId, layerId: ElementId, visible: boolean) =>
      service.setLayerVisibility(sceneId, layerId, visible),
    setLayerLocked: (sceneId: SceneId, layerId: ElementId, locked: boolean) =>
      service.setLayerLocked(sceneId, layerId, locked),
    addSource: (definition: SourceDefinition) => service.addSource(definition),
    renameSource: (sourceId: SourceId, name: string) => service.renameSource(sourceId, name),
    findSource: (sourceId: SourceId) => service.findSource(sourceId),
    removeSource: (sourceId: SourceId) => service.removeSource(sourceId),
  };
});
