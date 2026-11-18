import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';

import { STORE_KEYS } from '../../../core/app/constants/store-keys';
import type { AssetChanges, AssetDraft } from '../application/commands/asset-commands';
import type { AudioEffectLocation } from '../application/commands/audio-effect-commands';
import type { LayerUpdateChanges } from '../application/commands/layer-commands';
import type { AudioChannelChanges, AudioChannelDraft } from '../application/commands/mixer-commands';
import type {
  OverlayBusChanges,
  OverlaySoundChanges,
  OverlaySoundDraft,
  OverlayTriggerChanges,
  OverlayTriggerDraft,
} from '../application/commands/overlay-sound-commands';
import type { ProjectChanges } from '../application/commands/project-commands';
import type {
  AnimationSourceChanges,
  BrowserSourceChanges,
  SourceDefinition,
} from '../application/commands/source-commands';
import type { TransitionChanges, TransitionDraft } from '../application/commands/transition-commands';
import type { StudioResult } from '../application/errors';
import {
  createEmptyStudioSession,
  getActiveScene,
  getSelectedLayerId,
  type StudioSession,
} from '../application/session';
import { createStudioService } from '../application/studio.service';
import type { AudioMaster } from '../models/audio.domain';
import type { AudioEffectType } from '../models/audio-effect.domain';
import type {
  AssetId,
  ChannelId,
  EffectId,
  ElementId,
  GroupId,
  OverlaySoundId,
  OverlayTriggerId,
  SceneId,
  SourceId,
  TransitionId,
} from '../models/ids.domain';
import type { Project, ProjectType } from '../models/project.domain';
import type { AudioMigrationConflict } from '../serialization/audio-migration';

const deepFreeze = (value: unknown): void => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return;
  }
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
};

export const useStudioSessionStore = defineStore(STORE_KEYS.STUDIO_SESSION, () => {
  const sessionRef = shallowRef(createEmptyStudioSession());
  const audioMigrationConflicts = ref<AudioMigrationConflict[]>([]);

  const service = createStudioService({
    state: {
      get: () => sessionRef.value,
      set: (next) => {
        deepFreeze(next);
        sessionRef.value = next;
      },
    },
  });

  const project = computed(() => sessionRef.value.project);
  const activeSceneId = computed(() => sessionRef.value.editor.activeSceneId);
  const activeScene = computed(() => getActiveScene(sessionRef.value));
  const selectedLayerId = computed(() => getSelectedLayerId(sessionRef.value));
  const selectedLayerIds = computed(() => sessionRef.value.editor.selectedElementIds);
  const selectedOverlaySoundId = computed(() => sessionRef.value.editor.selectedOverlaySoundId);
  const selectedGlobalChannelId = computed(() => sessionRef.value.editor.selectedGlobalChannelId);
  const isDirty = computed(() => sessionRef.value.isDirty);
  const isInitialized = computed(() => sessionRef.value.isInitialized);
  const canUndo = computed(() => (sessionRef.value.project?.history.past.length ?? 0) > 0);
  const canRedo = computed(() => (sessionRef.value.project?.history.future.length ?? 0) > 0);

  return {
    project,
    activeSceneId,
    activeScene,
    selectedLayerId,
    selectedLayerIds,
    selectedOverlaySoundId,
    selectedGlobalChannelId,
    isDirty,
    isInitialized,
    canUndo,
    canRedo,
    audioMigrationConflicts,
    initialize: () => service.initialize(),
    undo: () => service.undo(),
    redo: () => service.redo(),
    runTransaction: (fn: () => StudioResult<StudioSession> | undefined) => service.runTransaction(fn),
    /** Edits between begin and end (a drag on the preview) undo as one step. */
    beginGesture: () => service.beginGesture(),
    endGesture: () => service.endGesture(),
    createProject: (input?: { name?: string; type?: ProjectType }) => {
      audioMigrationConflicts.value = [];
      return service.createProject(input);
    },
    openProject: (project: Project) => service.openProject(project),
    setAudioMigrationConflicts: (conflicts: AudioMigrationConflict[]) => {
      audioMigrationConflicts.value = conflicts;
    },
    dismissAudioMigrationConflicts: () => {
      audioMigrationConflicts.value = [];
    },
    closeProject: () => {
      audioMigrationConflicts.value = [];
      return service.closeProject();
    },
    markSaved: () => service.markSaved(),
    setActiveScene: (sceneId: SceneId) => service.setActiveScene(sceneId),
    selectLayer: (layerId: ElementId) => service.selectLayer(layerId),
    selectOverlaySound: (soundId: OverlaySoundId) => service.selectOverlaySound(soundId),
    selectGlobalChannel: (channelId: ChannelId) => service.selectGlobalChannel(channelId),
    setSelectedLayers: (layerIds: ElementId[]) => service.setSelectedLayers(layerIds),
    clearSelection: () => service.clearSelection(),
    createScene: (name?: string) => service.createScene(name),
    renameScene: (sceneId: SceneId, name: string) => service.renameScene(sceneId, name),
    duplicateScene: (sceneId: SceneId) => service.duplicateScene(sceneId),
    deleteScene: (sceneId: SceneId) => service.deleteScene(sceneId),
    moveSceneRelative: (sceneId: SceneId, direction: 'up' | 'down' | 'top' | 'bottom') =>
      service.moveSceneRelative(sceneId, direction),
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
    removeLayers: (sceneId: SceneId, layerIds: ElementId[]) => service.removeLayers(sceneId, layerIds),
    createGroupFromElements: (sceneId: SceneId, elementIds: ElementId[], name?: string) =>
      service.createGroupFromElements(sceneId, elementIds, name),
    addElementToGroup: (sceneId: SceneId, elementId: ElementId, groupId: GroupId) =>
      service.addElementToGroup(sceneId, elementId, groupId),
    groupElementsByDrop: (
      sceneId: SceneId,
      draggedElementId: ElementId,
      target: { kind: 'element'; elementId: ElementId } | { kind: 'group'; groupId: GroupId },
    ) => service.groupElementsByDrop(sceneId, draggedElementId, target),
    removeElementsFromGroup: (sceneId: SceneId, elementIds: ElementId[]) =>
      service.removeElementsFromGroup(sceneId, elementIds),
    dissolveGroup: (sceneId: SceneId, groupId: GroupId) => service.dissolveGroup(sceneId, groupId),
    renameGroup: (sceneId: SceneId, groupId: GroupId, name: string) => service.renameGroup(sceneId, groupId, name),
    renameLayer: (sceneId: SceneId, layerId: ElementId, name: string) => service.renameLayer(sceneId, layerId, name),
    duplicateLayer: (sceneId: SceneId, layerId: ElementId) => service.duplicateLayer(sceneId, layerId),
    updateLayer: (sceneId: SceneId, layerId: ElementId, changes: LayerUpdateChanges) =>
      service.updateLayer(sceneId, layerId, changes),
    moveLayer: (sceneId: SceneId, layerId: ElementId, targetIndex: number) =>
      service.moveLayer(sceneId, layerId, targetIndex),
    moveElementBlock: (
      sceneId: SceneId,
      elementIds: ElementId[],
      anchorElementId: ElementId,
      place: 'before' | 'after',
    ) => service.moveElementBlock(sceneId, elementIds, anchorElementId, place),
    moveLayerRelative: (sceneId: SceneId, layerId: ElementId, direction: 'up' | 'down' | 'top' | 'bottom') =>
      service.moveLayerRelative(sceneId, layerId, direction),
    setLayerVisibility: (sceneId: SceneId, layerId: ElementId, visible: boolean) =>
      service.setLayerVisibility(sceneId, layerId, visible),
    setLayerLocked: (sceneId: SceneId, layerId: ElementId, locked: boolean) =>
      service.setLayerLocked(sceneId, layerId, locked),
    setSceneDefaultTransition: (sceneId: SceneId, transitionId: TransitionId | null) =>
      service.setSceneDefaultTransition(sceneId, transitionId),
    addSource: (definition: SourceDefinition) => service.addSource(definition),
    renameSource: (sourceId: SourceId, name: string) => service.renameSource(sourceId, name),
    updateBrowserSource: (sourceId: SourceId, changes: BrowserSourceChanges) =>
      service.updateBrowserSource(sourceId, changes),
    setBrowserPageAudio: (sourceId: SourceId, enabled: boolean) => service.setBrowserPageAudio(sourceId, enabled),
    updateAnimationSource: (sourceId: SourceId, changes: AnimationSourceChanges) =>
      service.updateAnimationSource(sourceId, changes),
    findSource: (sourceId: SourceId) => service.findSource(sourceId),
    removeSource: (sourceId: SourceId) => service.removeSource(sourceId),
    updateProject: (changes: ProjectChanges) => service.updateProject(changes),
    addAsset: (draft: AssetDraft) => service.addAsset(draft),
    updateAsset: (assetId: AssetId, changes: AssetChanges) => service.updateAsset(assetId, changes),
    removeAsset: (assetId: AssetId) => service.removeAsset(assetId),
    updateAudioMaster: (changes: Partial<AudioMaster>) => service.updateAudioMaster(changes),
    updateOverlayBus: (changes: OverlayBusChanges) => service.updateOverlayBus(changes),
    addOverlaySound: (draft: OverlaySoundDraft) => service.addOverlaySound(draft),
    updateOverlaySound: (soundId: OverlaySoundId, changes: OverlaySoundChanges) =>
      service.updateOverlaySound(soundId, changes),
    removeOverlaySound: (soundId: OverlaySoundId) => service.removeOverlaySound(soundId),
    addOverlayTrigger: (draft: OverlayTriggerDraft) => service.addOverlayTrigger(draft),
    updateOverlayTrigger: (triggerId: OverlayTriggerId, changes: OverlayTriggerChanges) =>
      service.updateOverlayTrigger(triggerId, changes),
    removeOverlayTrigger: (triggerId: OverlayTriggerId) => service.removeOverlayTrigger(triggerId),
    addAudioChannel: (draft: AudioChannelDraft) => service.addAudioChannel(draft),
    updateAudioChannel: (channelId: ChannelId, changes: AudioChannelChanges) =>
      service.updateAudioChannel(channelId, changes),
    assignAudioSource: (channelId: ChannelId, sourceId: SourceId) => service.assignAudioSource(channelId, sourceId),
    removeAudioSource: (channelId: ChannelId, sourceId: SourceId) => service.removeAudioSource(channelId, sourceId),
    removeAudioChannel: (channelId: ChannelId) => service.removeAudioChannel(channelId),
    addAudioEffect: (location: AudioEffectLocation, type: AudioEffectType, name?: string) =>
      service.addAudioEffect(location, type, name),
    removeAudioEffect: (location: AudioEffectLocation, effectId: EffectId) =>
      service.removeAudioEffect(location, effectId),
    setAudioEffectEnabled: (location: AudioEffectLocation, effectId: EffectId, enabled: boolean) =>
      service.setAudioEffectEnabled(location, effectId, enabled),
    updateAudioEffectParameters: (location: AudioEffectLocation, effectId: EffectId, parameters: unknown) =>
      service.updateAudioEffectParameters(location, effectId, parameters),
    renameAudioEffect: (location: AudioEffectLocation, effectId: EffectId, name: string) =>
      service.renameAudioEffect(location, effectId, name),
    reorderAudioEffect: (location: AudioEffectLocation, effectId: EffectId, toIndex: number) =>
      service.reorderAudioEffect(location, effectId, toIndex),
    copyAudioEffect: (from: AudioEffectLocation, effectId: EffectId, to: AudioEffectLocation) =>
      service.copyAudioEffect(from, effectId, to),
    resetAudioEffect: (location: AudioEffectLocation, effectId: EffectId) =>
      service.resetAudioEffect(location, effectId),
    saveAudioChannelPreset: (channelId: ChannelId, name: string) => service.saveAudioChannelPreset(channelId, name),
    saveAudioEffectPreset: (location: AudioEffectLocation, effectId: EffectId, name: string) =>
      service.saveAudioEffectPreset(location, effectId, name),
    removeAudioPreset: (presetId: string) => service.removeAudioPreset(presetId),
    applyAudioChannelPreset: (channelId: ChannelId, presetId: string) =>
      service.applyAudioChannelPreset(channelId, presetId),
    applyAudioEffectPreset: (location: AudioEffectLocation, effectId: EffectId, presetId: string) =>
      service.applyAudioEffectPreset(location, effectId, presetId),
    addTransition: (draft: TransitionDraft) => service.addTransition(draft),
    updateTransition: (transitionId: TransitionId, changes: TransitionChanges) =>
      service.updateTransition(transitionId, changes),
    removeTransition: (transitionId: TransitionId) => service.removeTransition(transitionId),
  };
});
