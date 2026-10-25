import type { ElementId, GroupId, SceneId } from '../../models/ids.domain';
import { createSceneGroup, type SceneGroup } from '../../models/scene-group.domain';
import { portErr } from '../../ports/result';
import { displayNameSchema } from '../../schemas/display-name.schema';
import { assertInitialized, withClonedProject } from '../command-utils';
import type { CommandContext } from '../context';
import type { StudioResult } from '../errors';
import { findLayerInScene, findSceneInProject, type StudioSession } from '../session';
import { setSelectedLayers } from './session-commands';

const pruneEmptyGroups = (groups: SceneGroup[]) => groups.filter((group) => group.elementIds.length > 0);

const sortElementIdsBySceneOrder = (scene: { elements: { id: ElementId }[] }, elementIds: ElementId[]) => {
  const index = new Map(scene.elements.map((element, idx) => [element.id, idx]));
  return [...elementIds].sort((a, b) => (index.get(a) ?? 0) - (index.get(b) ?? 0));
};

export const createGroupFromElements = (
  session: StudioSession,
  sceneId: SceneId,
  elementIds: ElementId[],
  ctx: CommandContext,
  options?: { name?: string },
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const uniqueIds = [...new Set(elementIds)];
  if (uniqueIds.length < 2) {
    return portErr({ kind: 'invalid-argument', message: 'At least two elements are required to create a group' });
  }

  const scene = findSceneInProject(session.project, sceneId);
  if (!scene) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }

  for (const elementId of uniqueIds) {
    const element = findLayerInScene(scene, elementId);
    if (!element) {
      return portErr({ kind: 'layer-not-found', sceneId, layerId: elementId });
    }
    if (element.parentGroupId) {
      return portErr({
        kind: 'invalid-argument',
        message: `Element ${elementId} is already in a group`,
      });
    }
  }

  const orderedIds = sortElementIdsBySceneOrder(scene, uniqueIds);
  const groupId = ctx.generateId();

  const updated = withClonedProject(
    session,
    (project) => {
      const targetScene = project.scenes.find((item) => item.id === sceneId)!;
      const group = createSceneGroup({
        id: groupId,
        name: options?.name?.trim() || 'Group',
        elementIds: orderedIds,
        video: project.settings.video,
      });
      targetScene.groups.push(group);

      for (const elementId of orderedIds) {
        const element = targetScene.elements.find((item) => item.id === elementId)!;
        element.parentGroupId = groupId;
      }
    },
    ctx,
  );

  if (!updated.ok) {
    return updated;
  }

  return setSelectedLayers(updated.value, orderedIds);
};

export const addElementToGroup = (
  session: StudioSession,
  sceneId: SceneId,
  elementId: ElementId,
  groupId: GroupId,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const scene = findSceneInProject(session.project, sceneId);
  if (!scene) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }

  const element = findLayerInScene(scene, elementId);
  if (!element) {
    return portErr({ kind: 'layer-not-found', sceneId, layerId: elementId });
  }

  const group = scene.groups.find((item) => item.id === groupId);
  if (!group) {
    return portErr({ kind: 'invalid-argument', message: `Group ${groupId} not found` });
  }

  if (element.parentGroupId === groupId) {
    return { ok: true, value: session };
  }

  return withClonedProject(
    session,
    (project) => {
      const targetScene = project.scenes.find((item) => item.id === sceneId)!;
      const targetGroup = targetScene.groups.find((item) => item.id === groupId)!;
      const targetElement = targetScene.elements.find((item) => item.id === elementId)!;

      if (targetElement.parentGroupId && targetElement.parentGroupId !== groupId) {
        const previousGroup = targetScene.groups.find((item) => item.id === targetElement.parentGroupId);
        if (previousGroup) {
          previousGroup.elementIds = previousGroup.elementIds.filter((id) => id !== elementId);
        }
      }

      targetElement.parentGroupId = groupId;
      if (!targetGroup.elementIds.includes(elementId)) {
        targetGroup.elementIds.push(elementId);
      }

      syncGroupMemberOrder(targetScene);
    },
    ctx,
  );
};

const syncGroupMemberOrder = (scene: {
  elements: { id: ElementId; parentGroupId: GroupId | null }[];
  groups: { id: GroupId; elementIds: ElementId[] }[];
}) => {
  for (const group of scene.groups) {
    group.elementIds = scene.elements
      .filter((element) => element.parentGroupId === group.id)
      .map((element) => element.id);
  }
};

export const renameGroup = (
  session: StudioSession,
  sceneId: SceneId,
  groupId: GroupId,
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
      message: parsed.error.issues[0]?.message ?? 'Invalid group name',
    });
  }
  const trimmed = parsed.data;

  const scene = findSceneInProject(session.project, sceneId);
  if (!scene) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }

  if (!scene.groups.some((group) => group.id === groupId)) {
    return portErr({ kind: 'invalid-argument', message: `Group ${groupId} not found` });
  }

  return withClonedProject(
    session,
    (project) => {
      const targetScene = project.scenes.find((item) => item.id === sceneId)!;
      const group = targetScene.groups.find((item) => item.id === groupId)!;
      group.name = trimmed;
    },
    ctx,
  );
};

export const groupElementsByDrop = (
  session: StudioSession,
  sceneId: SceneId,
  draggedElementId: ElementId,
  target: { kind: 'element'; elementId: ElementId } | { kind: 'group'; groupId: GroupId },
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  if (draggedElementId === (target.kind === 'element' ? target.elementId : '')) {
    return { ok: true, value: session };
  }

  if (target.kind === 'group') {
    return addElementToGroup(session, sceneId, draggedElementId, target.groupId, ctx);
  }

  const scene = findSceneInProject(session.project!, sceneId);
  if (!scene) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }

  const dragged = findLayerInScene(scene, draggedElementId);
  const targetElement = findLayerInScene(scene, target.elementId);
  if (!dragged || !targetElement) {
    return portErr({ kind: 'layer-not-found', sceneId, layerId: draggedElementId });
  }

  if (targetElement.parentGroupId) {
    return addElementToGroup(session, sceneId, draggedElementId, targetElement.parentGroupId, ctx);
  }

  if (dragged.parentGroupId) {
    const removed = removeElementsFromGroup(session, sceneId, [draggedElementId], ctx);
    if (!removed.ok) {
      return removed;
    }
    return createGroupFromElements(removed.value, sceneId, [draggedElementId, target.elementId], ctx);
  }

  return createGroupFromElements(session, sceneId, [draggedElementId, target.elementId], ctx);
};

export const removeElementsFromGroup = (
  session: StudioSession,
  sceneId: SceneId,
  elementIds: ElementId[],
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const scene = findSceneInProject(session.project, sceneId);
  if (!scene) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }

  const uniqueIds = [...new Set(elementIds)];
  if (uniqueIds.length === 0) {
    return { ok: true, value: session };
  }

  return withClonedProject(
    session,
    (project) => {
      const targetScene = project.scenes.find((item) => item.id === sceneId)!;

      for (const elementId of uniqueIds) {
        const element = targetScene.elements.find((item) => item.id === elementId);
        if (!element?.parentGroupId) {
          continue;
        }

        const group = targetScene.groups.find((item) => item.id === element.parentGroupId);
        element.parentGroupId = null;
        if (group) {
          group.elementIds = group.elementIds.filter((id) => id !== elementId);
        }
      }

      syncGroupMemberOrder(targetScene);
      targetScene.groups = pruneEmptyGroups(targetScene.groups);
    },
    ctx,
  );
};

export const dissolveGroup = (
  session: StudioSession,
  sceneId: SceneId,
  groupId: GroupId,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const scene = findSceneInProject(session.project, sceneId);
  if (!scene) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }

  const group = scene.groups.find((item) => item.id === groupId);
  if (!group) {
    return portErr({ kind: 'invalid-argument', message: `Group ${groupId} not found` });
  }

  return removeElementsFromGroup(session, sceneId, group.elementIds, ctx);
};

export { pruneEmptyGroups };
