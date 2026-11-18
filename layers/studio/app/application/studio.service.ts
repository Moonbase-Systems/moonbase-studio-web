import type { AudioMaster } from '../models/audio.domain';
import type { AudioEffectType } from '../models/audio-effect.domain';
import type { HistoryEntry } from '../models/history.domain';
import type {
  AssetId,
  ChannelId,
  EffectId,
  ElementId,
  GroupId,
  HistoryEntryId,
  OverlaySoundId,
  OverlayTriggerId,
  SceneId,
  SourceId,
  TransitionId,
} from '../models/ids.domain';
import type { Project, ProjectType } from '../models/project.domain';
import type { SceneBackground } from '../models/scene.domain';
import {
  addAsset,
  addAudioChannel,
  addAudioEffect,
  addElementToGroup,
  addLayer,
  addOverlaySound,
  addOverlayTrigger,
  addSource,
  addTransition,
  applyAudioChannelPreset,
  applyAudioEffectPreset,
  assignAudioSource,
  clearSelection,
  closeProject,
  copyAudioEffect,
  createGroupFromElements,
  createProject,
  createScene,
  deleteScene,
  dissolveGroup,
  duplicateLayer,
  duplicateScene,
  findSource,
  groupElementsByDrop,
  initializeSession,
  markProjectSaved,
  moveElementBlock,
  moveLayer,
  moveLayerRelative,
  moveSceneRelative,
  openProject,
  pushHistoryEntry,
  redo,
  removeAsset,
  removeAudioChannel,
  removeAudioEffect,
  removeAudioPreset,
  removeAudioSource,
  removeElementsFromGroup,
  removeLayer,
  removeLayers,
  removeOverlaySound,
  removeOverlayTrigger,
  removeSource,
  removeTransition,
  renameAudioEffect,
  renameGroup,
  renameLayer,
  renameScene,
  renameSource,
  reorderAudioEffect,
  resetAudioEffectCommand,
  saveAudioChannelPreset,
  saveAudioEffectPreset,
  selectGlobalChannel,
  selectLayer,
  selectOverlaySound,
  setActiveScene,
  setAudioEffectEnabled,
  setBrowserPageAudio,
  setLayerLocked,
  setLayerVisibility,
  setSceneBackground,
  setSceneDefaultTransition,
  setSelectedLayers,
  undo,
  updateAnimationSource,
  updateAsset,
  updateAudioChannel,
  updateAudioEffectParameters,
  updateAudioMaster,
  updateBrowserSource,
  updateLayer,
  updateOverlayBus,
  updateOverlaySound,
  updateOverlayTrigger,
  updateProject,
  updateTransition,
} from './commands';
import type { AssetChanges, AssetDraft } from './commands/asset-commands';
import type { AudioEffectLocation } from './commands/audio-effect-commands';
import type { LayerUpdateChanges } from './commands/layer-commands';
import type { AudioChannelChanges, AudioChannelDraft } from './commands/mixer-commands';
import type {
  OverlayBusChanges,
  OverlaySoundChanges,
  OverlaySoundDraft,
  OverlayTriggerChanges,
  OverlayTriggerDraft,
} from './commands/overlay-sound-commands';
import type { ProjectChanges } from './commands/project-commands';
import type { AnimationSourceChanges, BrowserSourceChanges, SourceDefinition } from './commands/source-commands';
import type { TransitionChanges, TransitionDraft } from './commands/transition-commands';
import type { CommandContext } from './context';
import { createDefaultCommandContext as defaultContext } from './context';
import type { StudioResult } from './errors';
import { captureHistorySnapshot, historySnapshotsEqual } from './history-snapshot';
import { createEmptyStudioSession, type StudioSession } from './session';

export type StudioSessionState = {
  get(): StudioSession;
  set(session: StudioSession): void;
};

export type StudioService = ReturnType<typeof createStudioService>;

export type StudioRunOptions = {
  recordHistory?: boolean;
};

const createHistoryEntry = (
  before: NonNullable<ReturnType<typeof captureHistorySnapshot>>,
  after: NonNullable<ReturnType<typeof captureHistorySnapshot>>,
  context: CommandContext,
): HistoryEntry => ({
  id: context.generateId() as HistoryEntryId,
  label: 'Edit',
  timestamp: context.now(),
  patch: { inverse: before, forward: after },
});

export const createStudioService = (deps: { state: StudioSessionState; context?: CommandContext }) => {
  const ctx = deps.context ?? defaultContext();
  let historySuspended = false;
  /** State when a pointer gesture started; its edits land as one history entry when it ends. */
  let gestureStart: ReturnType<typeof captureHistorySnapshot> = null;

  const run = (
    command: (session: StudioSession, context: CommandContext) => StudioResult<StudioSession>,
    options?: StudioRunOptions,
  ): StudioResult<StudioSession> => {
    const recordHistory = options?.recordHistory ?? true;
    const current = deps.state.get();
    const before =
      recordHistory && !historySuspended && !gestureStart && current.project ? captureHistorySnapshot(current) : null;
    const result = command(current, ctx);
    if (!result.ok) {
      return result;
    }

    let next = result.value;
    if (before) {
      const after = captureHistorySnapshot(next);
      if (after && !historySnapshotsEqual(before, after)) {
        const pushed = pushHistoryEntry(next, createHistoryEntry(before, after, ctx), ctx);
        if (pushed.ok) {
          next = pushed.value;
        }
      }
    }

    deps.state.set(next);
    return { ok: true, value: next };
  };

  const query = <T>(command: (session: StudioSession) => StudioResult<T>): StudioResult<T> => command(deps.state.get());

  const runTransaction = (fn: () => StudioResult<StudioSession> | undefined): StudioResult<StudioSession> => {
    const checkpoint = structuredClone(deps.state.get());
    historySuspended = true;
    let result: StudioResult<StudioSession> | undefined;
    try {
      result = fn();
    } catch (error) {
      historySuspended = false;
      deps.state.set(checkpoint);
      throw error;
    }
    historySuspended = false;

    if (result && !result.ok) {
      deps.state.set(checkpoint);
      return result;
    }

    const before = captureHistorySnapshot(checkpoint);
    if (!before) {
      return { ok: true, value: deps.state.get() };
    }
    const after = captureHistorySnapshot(deps.state.get());
    if (after && !historySnapshotsEqual(before, after)) {
      const pushed = pushHistoryEntry(deps.state.get(), createHistoryEntry(before, after, ctx), ctx);
      if (!pushed.ok) {
        deps.state.set(checkpoint);
        return pushed;
      }
      deps.state.set(pushed.value);
      return { ok: true, value: pushed.value };
    }
    return { ok: true, value: deps.state.get() };
  };

  const beginGesture = (): void => {
    gestureStart = captureHistorySnapshot(deps.state.get());
  };

  const endGesture = (): void => {
    const before = gestureStart;
    gestureStart = null;
    if (!before) {
      return;
    }
    const after = captureHistorySnapshot(deps.state.get());
    if (after && !historySnapshotsEqual(before, after)) {
      const pushed = pushHistoryEntry(deps.state.get(), createHistoryEntry(before, after, ctx), ctx);
      if (pushed.ok) {
        deps.state.set(pushed.value);
      }
    }
  };

  return {
    getSession: (): StudioSession => deps.state.get(),

    initialize: () => run((session) => initializeSession(session), { recordHistory: false }),

    createProject: (input?: { name?: string; type?: ProjectType }) =>
      run((session, context) => createProject(session, input, context), { recordHistory: false }),

    openProject: (project: Project) =>
      run((session, context) => openProject(session, project, context), { recordHistory: false }),

    closeProject: () => run((session) => closeProject(session), { recordHistory: false }),

    markSaved: () => run((session) => markProjectSaved(session), { recordHistory: false }),

    undo: () => run((session, context) => undo(session, context), { recordHistory: false }),

    redo: () => run((session, context) => redo(session, context), { recordHistory: false }),

    runTransaction,

    beginGesture,

    endGesture,

    setActiveScene: (sceneId: SceneId) => run((session) => setActiveScene(session, sceneId), { recordHistory: false }),

    selectLayer: (layerId: ElementId) => run((session) => selectLayer(session, layerId), { recordHistory: false }),

    selectOverlaySound: (soundId: OverlaySoundId) =>
      run((session) => selectOverlaySound(session, soundId), { recordHistory: false }),

    selectGlobalChannel: (channelId: ChannelId) =>
      run((session) => selectGlobalChannel(session, channelId), { recordHistory: false }),

    setSelectedLayers: (layerIds: ElementId[]) =>
      run((session) => setSelectedLayers(session, layerIds), { recordHistory: false }),

    clearSelection: () => run((session) => clearSelection(session), { recordHistory: false }),

    createScene: (name?: string) => run((session, context) => createScene(session, name, context)),

    renameScene: (sceneId: SceneId, name: string) =>
      run((session, context) => renameScene(session, sceneId, name, context)),

    duplicateScene: (sceneId: SceneId) => run((session, context) => duplicateScene(session, sceneId, context)),

    deleteScene: (sceneId: SceneId) => run((session, context) => deleteScene(session, sceneId, context)),

    moveSceneRelative: (sceneId: SceneId, direction: 'up' | 'down' | 'top' | 'bottom') =>
      run((session, context) => moveSceneRelative(session, sceneId, direction, context)),

    addLayer: (
      sceneId: SceneId,
      sourceId: SourceId,
      options?: {
        name?: string;
        transform?: LayerUpdateChanges['transform'];
        appearance?: LayerUpdateChanges['appearance'];
      },
    ) => run((session, context) => addLayer(session, sceneId, sourceId, options, context)),

    removeLayer: (sceneId: SceneId, layerId: ElementId) =>
      run((session, context) => removeLayer(session, sceneId, layerId, context)),

    removeLayers: (sceneId: SceneId, layerIds: ElementId[]) =>
      run((session, context) => removeLayers(session, sceneId, layerIds, context)),

    createGroupFromElements: (sceneId: SceneId, elementIds: ElementId[], name?: string) =>
      run((session, context) => createGroupFromElements(session, sceneId, elementIds, context, { name })),

    addElementToGroup: (sceneId: SceneId, elementId: ElementId, groupId: GroupId) =>
      run((session, context) => addElementToGroup(session, sceneId, elementId, groupId, context)),

    groupElementsByDrop: (
      sceneId: SceneId,
      draggedElementId: ElementId,
      target: { kind: 'element'; elementId: ElementId } | { kind: 'group'; groupId: GroupId },
    ) => run((session, context) => groupElementsByDrop(session, sceneId, draggedElementId, target, context)),

    removeElementsFromGroup: (sceneId: SceneId, elementIds: ElementId[]) =>
      run((session, context) => removeElementsFromGroup(session, sceneId, elementIds, context)),

    dissolveGroup: (sceneId: SceneId, groupId: GroupId) =>
      run((session, context) => dissolveGroup(session, sceneId, groupId, context)),

    renameGroup: (sceneId: SceneId, groupId: GroupId, name: string) =>
      run((session, context) => renameGroup(session, sceneId, groupId, name, context)),

    renameLayer: (sceneId: SceneId, layerId: ElementId, name: string) =>
      run((session, context) => renameLayer(session, sceneId, layerId, name, context)),

    duplicateLayer: (sceneId: SceneId, layerId: ElementId) =>
      run((session, context) => duplicateLayer(session, sceneId, layerId, context)),

    updateLayer: (sceneId: SceneId, layerId: ElementId, changes: LayerUpdateChanges) =>
      run((session, context) => updateLayer(session, sceneId, layerId, changes, context)),

    moveLayer: (sceneId: SceneId, layerId: ElementId, targetIndex: number) =>
      run((session, context) => moveLayer(session, sceneId, layerId, targetIndex, context)),

    moveElementBlock: (
      sceneId: SceneId,
      elementIds: ElementId[],
      anchorElementId: ElementId,
      place: 'before' | 'after',
    ) => run((session, context) => moveElementBlock(session, sceneId, elementIds, anchorElementId, place, context)),

    moveLayerRelative: (sceneId: SceneId, layerId: ElementId, direction: 'up' | 'down' | 'top' | 'bottom') =>
      run((session, context) => moveLayerRelative(session, sceneId, layerId, direction, context)),

    setLayerVisibility: (sceneId: SceneId, layerId: ElementId, visible: boolean) =>
      run((session, context) => setLayerVisibility(session, sceneId, layerId, visible, context)),

    setLayerLocked: (sceneId: SceneId, layerId: ElementId, locked: boolean) =>
      run((session, context) => setLayerLocked(session, sceneId, layerId, locked, context)),

    setSceneBackground: (sceneId: SceneId, background: SceneBackground) =>
      run((session, context) => setSceneBackground(session, sceneId, background, context)),

    setSceneDefaultTransition: (sceneId: SceneId, transitionId: TransitionId | null) =>
      run((session, context) => setSceneDefaultTransition(session, sceneId, transitionId, context)),

    addSource: (definition: SourceDefinition) => run((session, context) => addSource(session, definition, context)),

    renameSource: (sourceId: SourceId, name: string) =>
      run((session, context) => renameSource(session, sourceId, name, context)),

    updateBrowserSource: (sourceId: SourceId, changes: BrowserSourceChanges) =>
      run((session, context) => updateBrowserSource(session, sourceId, changes, context)),

    setBrowserPageAudio: (sourceId: SourceId, enabled: boolean) =>
      run((session, context) => setBrowserPageAudio(session, sourceId, enabled, context)),

    updateAnimationSource: (sourceId: SourceId, changes: AnimationSourceChanges) =>
      run((session, context) => updateAnimationSource(session, sourceId, changes, context)),

    findSource: (sourceId: SourceId) => query((session) => findSource(session, sourceId)),

    removeSource: (sourceId: SourceId) => run((session, context) => removeSource(session, sourceId, context)),

    updateProject: (changes: ProjectChanges) => run((session, context) => updateProject(session, changes, context)),

    addAsset: (draft: AssetDraft) => run((session, context) => addAsset(session, draft, context)),

    updateAsset: (assetId: AssetId, changes: AssetChanges) =>
      run((session, context) => updateAsset(session, assetId, changes, context)),

    removeAsset: (assetId: AssetId) => run((session, context) => removeAsset(session, assetId, context)),

    updateAudioMaster: (changes: Partial<AudioMaster>) =>
      run((session, context) => updateAudioMaster(session, changes, context)),

    updateOverlayBus: (changes: OverlayBusChanges) =>
      run((session, context) => updateOverlayBus(session, changes, context)),

    addOverlaySound: (draft: OverlaySoundDraft) => run((session, context) => addOverlaySound(session, draft, context)),

    updateOverlaySound: (soundId: OverlaySoundId, changes: OverlaySoundChanges) =>
      run((session, context) => updateOverlaySound(session, soundId, changes, context)),

    removeOverlaySound: (soundId: OverlaySoundId) =>
      run((session, context) => removeOverlaySound(session, soundId, context)),

    addOverlayTrigger: (draft: OverlayTriggerDraft) =>
      run((session, context) => addOverlayTrigger(session, draft, context)),

    updateOverlayTrigger: (triggerId: OverlayTriggerId, changes: OverlayTriggerChanges) =>
      run((session, context) => updateOverlayTrigger(session, triggerId, changes, context)),

    removeOverlayTrigger: (triggerId: OverlayTriggerId) =>
      run((session, context) => removeOverlayTrigger(session, triggerId, context)),

    addAudioChannel: (draft: AudioChannelDraft) => run((session, context) => addAudioChannel(session, draft, context)),

    updateAudioChannel: (channelId: ChannelId, changes: AudioChannelChanges) =>
      run((session, context) => updateAudioChannel(session, channelId, changes, context)),

    assignAudioSource: (channelId: ChannelId, sourceId: SourceId) =>
      run((session, context) => assignAudioSource(session, channelId, sourceId, context)),

    removeAudioSource: (channelId: ChannelId, sourceId: SourceId) =>
      run((session, context) => removeAudioSource(session, channelId, sourceId, context)),

    removeAudioChannel: (channelId: ChannelId) =>
      run((session, context) => removeAudioChannel(session, channelId, context)),

    addAudioEffect: (location: AudioEffectLocation, type: AudioEffectType, name?: string) =>
      run((session, context) => addAudioEffect(session, location, type, context, name)),

    removeAudioEffect: (location: AudioEffectLocation, effectId: EffectId) =>
      run((session, context) => removeAudioEffect(session, location, effectId, context)),

    setAudioEffectEnabled: (location: AudioEffectLocation, effectId: EffectId, enabled: boolean) =>
      run((session, context) => setAudioEffectEnabled(session, location, effectId, enabled, context)),

    updateAudioEffectParameters: (location: AudioEffectLocation, effectId: EffectId, parameters: unknown) =>
      run((session, context) => updateAudioEffectParameters(session, location, effectId, parameters, context)),

    renameAudioEffect: (location: AudioEffectLocation, effectId: EffectId, name: string) =>
      run((session, context) => renameAudioEffect(session, location, effectId, name, context)),

    reorderAudioEffect: (location: AudioEffectLocation, effectId: EffectId, toIndex: number) =>
      run((session, context) => reorderAudioEffect(session, location, effectId, toIndex, context)),

    copyAudioEffect: (from: AudioEffectLocation, effectId: EffectId, to: AudioEffectLocation) =>
      run((session, context) => copyAudioEffect(session, from, effectId, to, context)),

    resetAudioEffect: (location: AudioEffectLocation, effectId: EffectId) =>
      run((session, context) => resetAudioEffectCommand(session, location, effectId, context)),

    saveAudioChannelPreset: (channelId: ChannelId, name: string) =>
      run((session, context) => saveAudioChannelPreset(session, channelId, name, context)),

    saveAudioEffectPreset: (location: AudioEffectLocation, effectId: EffectId, name: string) =>
      run((session, context) => saveAudioEffectPreset(session, location, effectId, name, context)),

    removeAudioPreset: (presetId: string) => run((session, context) => removeAudioPreset(session, presetId, context)),

    applyAudioChannelPreset: (channelId: ChannelId, presetId: string) =>
      run((session, context) => applyAudioChannelPreset(session, channelId, presetId, context)),

    applyAudioEffectPreset: (location: AudioEffectLocation, effectId: EffectId, presetId: string) =>
      run((session, context) => applyAudioEffectPreset(session, location, effectId, presetId, context)),

    addTransition: (draft: TransitionDraft) => run((session, context) => addTransition(session, draft, context)),

    updateTransition: (transitionId: TransitionId, changes: TransitionChanges) =>
      run((session, context) => updateTransition(session, transitionId, changes, context)),

    removeTransition: (transitionId: TransitionId) =>
      run((session, context) => removeTransition(session, transitionId, context)),
  };
};

export { createEmptyStudioSession };
