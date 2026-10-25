import type { SceneId } from '../../models/ids.domain';
import { createEmptyScene } from '../../models/scene.domain';
import { portErr } from '../../ports/result';
import { displayNameSchema } from '../../schemas/display-name.schema';
import { assertInitialized, withClonedProject } from '../command-utils';
import type { CommandContext } from '../context';
import type { StudioResult } from '../errors';
import { duplicateSceneWithNewIds } from '../scene-clone';
import { findSceneInProject, type StudioSession } from '../session';
import { setActiveScene } from './session-commands';

export { setActiveScene };

const resolveDefaultSceneName = (session: StudioSession, preferred?: string): string | null => {
  const trimmed = preferred?.trim();
  if (trimmed) {
    return trimmed;
  }

  const project = session.project!;
  const fromPrefs = project.settings.preferences.defaultSceneName?.trim();
  const existing = new Set(project.scenes.map((scene) => scene.name));

  if (fromPrefs && !existing.has(fromPrefs)) {
    return fromPrefs;
  }

  for (let index = 1; index <= project.scenes.length + 1; index += 1) {
    const candidate = `Scene ${index}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const createScene = (
  session: StudioSession,
  name: string | undefined,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const sceneName = resolveDefaultSceneName(session, name);
  if (!sceneName) {
    return portErr({ kind: 'invalid-argument', message: 'Scene name cannot be empty' });
  }

  const newSceneId = ctx.generateId();

  const updated = withClonedProject(
    session,
    (project) => {
      project.scenes.push(createEmptyScene({ id: newSceneId, name: sceneName }));
    },
    ctx,
  );

  if (!updated.ok) {
    return updated;
  }

  return setActiveScene(updated.value, newSceneId);
};

export const renameScene = (
  session: StudioSession,
  sceneId: SceneId,
  name: string,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const parsed = displayNameSchema.safeParse(name);
  if (!parsed.success) {
    return portErr({
      kind: 'invalid-argument',
      message: parsed.error.issues[0]?.message ?? 'Invalid scene name',
    });
  }

  if (!findSceneInProject(session.project, sceneId)) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }

  return withClonedProject(
    session,
    (project) => {
      const scene = project.scenes.find((item) => item.id === sceneId)!;
      scene.name = parsed.data;
    },
    ctx,
  );
};

export const moveSceneRelative = (
  session: StudioSession,
  sceneId: SceneId,
  direction: 'up' | 'down' | 'top' | 'bottom',
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const fromIndex = session.project.scenes.findIndex((scene) => scene.id === sceneId);
  if (fromIndex === -1) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }

  const lastIndex = session.project.scenes.length - 1;
  let targetIndex = fromIndex;
  if (direction === 'up') {
    targetIndex = Math.max(0, fromIndex - 1);
  } else if (direction === 'down') {
    targetIndex = Math.min(lastIndex, fromIndex + 1);
  } else if (direction === 'top') {
    targetIndex = 0;
  } else {
    targetIndex = lastIndex;
  }

  if (fromIndex === targetIndex) {
    return { ok: true, value: session };
  }

  return withClonedProject(
    session,
    (project) => {
      const [item] = project.scenes.splice(fromIndex, 1);
      project.scenes.splice(targetIndex, 0, item!);
    },
    ctx,
  );
};

export const duplicateScene = (
  session: StudioSession,
  sceneId: SceneId,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const sourceIndex = session.project.scenes.findIndex((scene) => scene.id === sceneId);
  if (sourceIndex === -1) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }

  const sourceScene = session.project.scenes[sourceIndex]!;
  const duplicate = duplicateSceneWithNewIds(sourceScene, ctx);

  const updated = withClonedProject(
    session,
    (project) => {
      project.scenes.splice(sourceIndex + 1, 0, duplicate);
    },
    ctx,
  );

  if (!updated.ok) {
    return updated;
  }

  return setActiveScene(updated.value, duplicate.id);
};

/**
 * Deleting the last scene is rejected (`rule-violation: last-scene`).
 * No replacement scene is created automatically.
 */
export const deleteScene = (
  session: StudioSession,
  sceneId: SceneId,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  if (session.project.scenes.length <= 1) {
    return portErr({
      kind: 'rule-violation',
      rule: 'last-scene',
      message: 'Cannot delete the last scene in the project',
    });
  }

  const deleteIndex = session.project.scenes.findIndex((scene) => scene.id === sceneId);
  if (deleteIndex === -1) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }

  const wasActive = session.editor.activeSceneId === sceneId;
  const selectedLayerId = session.editor.selectedElementIds[0];
  const deletedScene = session.project.scenes[deleteIndex]!;
  const selectionInDeletedScene =
    selectedLayerId != null && deletedScene.elements.some((element) => element.id === selectedLayerId);

  const updated = withClonedProject(
    session,
    (project) => {
      project.scenes.splice(deleteIndex, 1);
    },
    ctx,
  );

  if (!updated.ok) {
    return updated;
  }

  if (!wasActive && !selectionInDeletedScene) {
    return updated;
  }

  const remaining = updated.value.project!.scenes;
  const nextActiveId =
    wasActive && remaining.length > 0
      ? (remaining[deleteIndex]?.id ?? remaining[deleteIndex - 1]?.id ?? remaining[0]!.id)
      : updated.value.editor.activeSceneId;

  let nextSession = updated.value;
  if (wasActive && nextActiveId) {
    const activeResult = setActiveScene(nextSession, nextActiveId);
    if (!activeResult.ok) {
      return activeResult;
    }
    nextSession = activeResult.value;
  } else if (selectionInDeletedScene) {
    nextSession = {
      ...nextSession,
      editor: {
        ...nextSession.editor,
        selectedElementIds: [],
        selectedGroupIds: [],
      },
    };
  }

  return { ok: true, value: nextSession };
};
