import { createEmptyEditorState, type EditorState } from '../models/editor.domain';
import type { ElementId, SceneId } from '../models/ids.domain';
import type { Project } from '../models/project.domain';
import type { Scene } from '../models/scene.domain';
import type { SceneElement } from '../models/scene-element.domain';
import { portErr, portOk } from '../ports/result';
import { parseProjectFile, toProjectFile } from '../serialization/project-file';
import type { StudioResult } from './errors';

export type StudioSession = {
  project: Project | null;
  editor: EditorState;
  isDirty: boolean;
  isInitialized: boolean;
};

export const createEmptyStudioSession = (): StudioSession => ({
  project: null,
  editor: createEmptyEditorState(),
  isDirty: false,
  isInitialized: false,
});

export const getSelectedLayerId = (session: StudioSession): ElementId | null =>
  session.editor.selectedElementIds[0] ?? null;

export const getActiveScene = (session: StudioSession): Scene | null => {
  const { project, editor } = session;
  if (!project || !editor.activeSceneId) {
    return null;
  }
  return project.scenes.find((scene) => scene.id === editor.activeSceneId) ?? null;
};

export const validateProject = (project: Project): StudioResult<Project> => {
  const result = parseProjectFile(toProjectFile(project));
  if (!result.ok) {
    return portErr({
      kind: 'invalid-argument',
      message: 'Project validation failed',
      issues: result.error.issues,
    });
  }
  return portOk(result.project);
};

/** Keeps active scene and selection consistent with the open project. */
export const normalizeEditor = (editor: EditorState, project: Project | null): EditorState => {
  if (!project) {
    return createEmptyEditorState();
  }

  const sceneIds = new Set(project.scenes.map((scene) => scene.id));
  let activeSceneId: SceneId | null = editor.activeSceneId;
  if (!activeSceneId || !sceneIds.has(activeSceneId)) {
    activeSceneId = project.scenes[0]?.id ?? null;
  }

  const activeScene = project.scenes.find((scene) => scene.id === activeSceneId);
  const elementIds = new Set(activeScene?.elements.map((el) => el.id) ?? []);
  const selectedElementIds = editor.selectedElementIds.filter((id) => elementIds.has(id));

  return {
    ...editor,
    activeSceneId,
    selectedElementIds,
    selectedGroupIds: [],
  };
};

export const findSceneInProject = (project: Project, sceneId: SceneId): Scene | undefined =>
  project.scenes.find((scene) => scene.id === sceneId);

export const findLayerInScene = (scene: Scene, layerId: ElementId): SceneElement | undefined =>
  scene.elements.find((element) => element.id === layerId);
