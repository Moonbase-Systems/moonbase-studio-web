import { createEmptyEditorState } from '../../models/editor.domain';
import { createEmptyHistory } from '../../models/history.domain';
import type { ElementId, SceneId } from '../../models/ids.domain';
import { createEmptyProject, type Project, type ProjectType } from '../../models/project.domain';
import { portErr, portOk } from '../../ports/result';
import { assertInitialized, sessionWithoutDirty } from '../command-utils';
import type { CommandContext } from '../context';
import type { StudioResult } from '../errors';
import { findLayerInScene, findSceneInProject, normalizeEditor, type StudioSession, validateProject } from '../session';

export const initializeSession = (session: StudioSession): StudioResult<StudioSession> =>
  portOk({ ...session, isInitialized: true });

export const createProject = (
  session: StudioSession,
  input: { name?: string; type?: ProjectType } | undefined,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }

  const project = createEmptyProject({
    id: ctx.generateId(),
    name: input?.name?.trim() || 'Untitled Project',
    type: input?.type ?? 'general',
  });

  const validated = validateProject(project);
  if (!validated.ok) {
    return validated;
  }

  const activeSceneId = null;

  return portOk({
    project: validated.value,
    editor: normalizeEditor({ ...createEmptyEditorState(), activeSceneId }, validated.value),
    isDirty: false,
    isInitialized: true,
  });
};

export const openProject = (
  session: StudioSession,
  project: Project,
  _ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }

  const validated = validateProject({ ...project, history: createEmptyHistory() });
  if (!validated.ok) {
    return validated;
  }

  const activeSceneId = validated.value.scenes[0]?.id ?? null;

  return portOk({
    project: validated.value,
    editor: normalizeEditor({ ...createEmptyEditorState(), activeSceneId }, validated.value),
    isDirty: false,
    isInitialized: true,
  });
};

export const closeProject = (session: StudioSession): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }

  return portOk({
    ...session,
    project: null,
    editor: createEmptyEditorState(),
    isDirty: false,
  });
};

export const markProjectSaved = (session: StudioSession): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }
  return portOk({ ...session, isDirty: false });
};

/** Switching the active scene does not mark the project dirty. Clears layer selection. */
export const setActiveScene = (session: StudioSession, sceneId: SceneId): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  if (!findSceneInProject(session.project, sceneId)) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }

  const editor = {
    ...session.editor,
    activeSceneId: sceneId,
    selectedElementIds: [],
    selectedGroupIds: [],
  };

  return portOk(sessionWithoutDirty(session, editor));
};

/** Selection changes do not mark the project dirty. */
export const setSelectedLayers = (session: StudioSession, layerIds: ElementId[]): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project || !session.editor.activeSceneId) {
    return portErr({ kind: 'no-project' });
  }

  const scene = findSceneInProject(session.project, session.editor.activeSceneId);
  if (!scene) {
    return portErr({ kind: 'scene-not-found', sceneId: session.editor.activeSceneId });
  }

  const validIds = layerIds.filter((layerId) => findLayerInScene(scene, layerId));
  const editor = {
    ...session.editor,
    selectedElementIds: validIds,
    selectedGroupIds: [],
  };

  return portOk(sessionWithoutDirty(session, editor));
};

export const selectLayer = (session: StudioSession, layerId: ElementId): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project || !session.editor.activeSceneId) {
    return portErr({ kind: 'no-project' });
  }

  const scene = findSceneInProject(session.project, session.editor.activeSceneId);
  if (!scene) {
    return portErr({ kind: 'scene-not-found', sceneId: session.editor.activeSceneId });
  }

  if (!findLayerInScene(scene, layerId)) {
    return portErr({ kind: 'layer-not-found', sceneId: scene.id, layerId });
  }

  const editor = {
    ...session.editor,
    selectedElementIds: [layerId],
    selectedGroupIds: [],
  };

  return portOk(sessionWithoutDirty(session, editor));
};

export const clearSelection = (session: StudioSession): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }

  const editor = {
    ...session.editor,
    selectedElementIds: [],
    selectedGroupIds: [],
  };

  return portOk(sessionWithoutDirty(session, editor));
};
