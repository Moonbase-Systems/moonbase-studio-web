import type { ElementId, GroupId, SceneId, SourceId } from '../models/ids.domain';
import type { Project, ProjectType } from '../models/project.domain';
import {
  addElementToGroup,
  addLayer,
  addSource,
  clearSelection,
  closeProject,
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
  removeElementsFromGroup,
  removeLayer,
  removeLayers,
  removeSource,
  renameGroup,
  renameLayer,
  renameScene,
  renameSource,
  selectLayer,
  setActiveScene,
  setLayerLocked,
  setLayerVisibility,
  setSelectedLayers,
  updateLayer,
} from './commands';
import type { LayerUpdateChanges } from './commands/layer-commands';
import type { SourceDefinition } from './commands/source-commands';
import type { CommandContext } from './context';
import { createDefaultCommandContext as defaultContext } from './context';
import type { StudioResult } from './errors';
import { createEmptyStudioSession, type StudioSession } from './session';

export type StudioSessionState = {
  get(): StudioSession;
  set(session: StudioSession): void;
};

export type StudioService = ReturnType<typeof createStudioService>;

export const createStudioService = (deps: { state: StudioSessionState; context?: CommandContext }) => {
  const ctx = deps.context ?? defaultContext();

  const run = (
    command: (session: StudioSession, context: CommandContext) => StudioResult<StudioSession>,
  ): StudioResult<StudioSession> => {
    const current = deps.state.get();
    const result = command(current, ctx);
    if (result.ok) {
      deps.state.set(result.value);
    }
    return result;
  };

  const query = <T>(command: (session: StudioSession) => StudioResult<T>): StudioResult<T> => command(deps.state.get());

  return {
    getSession: (): StudioSession => deps.state.get(),

    initialize: () => run((session) => initializeSession(session)),

    createProject: (input?: { name?: string; type?: ProjectType }) =>
      run((session, context) => createProject(session, input, context)),

    openProject: (project: Project) => run((session, context) => openProject(session, project, context)),

    closeProject: () => run((session) => closeProject(session)),

    markSaved: () => run((session) => markProjectSaved(session)),

    setActiveScene: (sceneId: SceneId) => run((session) => setActiveScene(session, sceneId)),

    selectLayer: (layerId: ElementId) => run((session) => selectLayer(session, layerId)),

    setSelectedLayers: (layerIds: ElementId[]) => run((session) => setSelectedLayers(session, layerIds)),

    clearSelection: () => run((session) => clearSelection(session)),

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

    addSource: (definition: SourceDefinition) => run((session, context) => addSource(session, definition, context)),

    renameSource: (sourceId: SourceId, name: string) =>
      run((session, context) => renameSource(session, sourceId, name, context)),

    findSource: (sourceId: SourceId) => query((session) => findSource(session, sourceId)),

    removeSource: (sourceId: SourceId) => run((session, context) => removeSource(session, sourceId, context)),
  };
};

export { createEmptyStudioSession };
