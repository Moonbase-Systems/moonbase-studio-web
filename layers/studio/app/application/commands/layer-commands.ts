import type { Appearance, ElementCrop, ElementEffect, Transform2D } from '../../models/common.domain';
import type { ElementId, SceneId, SourceId } from '../../models/ids.domain';
import { createSourceBackedElement, type OverlayContent, type SceneElement } from '../../models/scene-element.domain';
import { portErr } from '../../ports/result';
import { displayNameSchema } from '../../schemas/display-name.schema';
import {
  appearanceSchema,
  elementCropSchema,
  transform2DSchema,
} from '../../schemas/scene-elements/element-shared.schema';
import { assertInitialized, commitProjectChange, withClonedProject } from '../command-utils';
import type { CommandContext } from '../context';
import type { StudioResult } from '../errors';
import { mergeElementSettings } from '../merge-element-settings';
import { duplicateSceneElement } from '../scene-clone';
import { findLayerInScene, findSceneInProject, type StudioSession } from '../session';
import { selectLayer } from './session-commands';

const ALLOWED_LAYER_UPDATE_KEYS = new Set([
  'name',
  'visibility',
  'locked',
  'transform',
  'crop',
  'appearance',
  'effects',
  'settings',
  'content',
]);

export type LayerUpdateChanges = {
  name?: string;
  visibility?: boolean;
  locked?: boolean;
  transform?: Partial<Transform2D>;
  crop?: Partial<ElementCrop>;
  appearance?: Partial<Appearance>;
  effects?: ElementEffect[];
  settings?: Record<string, unknown>;
  content?: OverlayContent;
};

const assertUniqueEffectIds = (effects: ElementEffect[]): StudioResult<void> => {
  const seen = new Set<string>();
  for (const effect of effects) {
    if (seen.has(effect.id)) {
      return portErr({
        kind: 'invalid-argument',
        message: `Duplicate effect id: ${effect.id}`,
      });
    }
    seen.add(effect.id);
  }
  return { ok: true, value: undefined };
};

const applyLayerUpdate = (element: SceneElement, changes: LayerUpdateChanges): StudioResult<void> => {
  for (const key of Object.keys(changes)) {
    if (!ALLOWED_LAYER_UPDATE_KEYS.has(key)) {
      return portErr({
        kind: 'invalid-argument',
        message: `Field "${key}" cannot be updated via updateLayer`,
      });
    }
  }

  if (changes.content !== undefined && element.type !== 'overlay') {
    return portErr({
      kind: 'invalid-argument',
      message: 'content can only be updated on overlay layers',
    });
  }

  if (changes.name !== undefined) {
    const parsed = displayNameSchema.safeParse(changes.name);
    if (!parsed.success) {
      return portErr({
        kind: 'invalid-argument',
        message: parsed.error.issues[0]?.message ?? 'Invalid layer name',
      });
    }
    element.name = parsed.data;
  }

  if (changes.visibility !== undefined) {
    element.visibility = changes.visibility;
  }

  if (changes.locked !== undefined) {
    element.locked = changes.locked;
  }

  if (changes.transform) {
    const merged = { ...element.transform, ...changes.transform };
    const parsed = transform2DSchema.safeParse(merged);
    if (!parsed.success) {
      return portErr({
        kind: 'invalid-argument',
        message: parsed.error.issues[0]?.message ?? 'Invalid transform',
      });
    }
    element.transform = parsed.data;
  }

  if (changes.crop) {
    const merged = { ...element.crop, ...changes.crop };
    const parsed = elementCropSchema.safeParse(merged);
    if (!parsed.success) {
      return portErr({
        kind: 'invalid-argument',
        message: parsed.error.issues[0]?.message ?? 'Invalid crop',
      });
    }
    element.crop = parsed.data;
  }

  if (changes.appearance) {
    const merged = { ...element.appearance, ...changes.appearance };
    const parsed = appearanceSchema.safeParse(merged);
    if (!parsed.success) {
      return portErr({
        kind: 'invalid-argument',
        message: parsed.error.issues[0]?.message ?? 'Invalid appearance',
      });
    }
    element.appearance = parsed.data;
  }

  if (changes.settings) {
    const merged = mergeElementSettings(element, changes.settings);
    if (!merged.ok) {
      return merged;
    }
  }

  if (changes.effects) {
    const unique = assertUniqueEffectIds(changes.effects);
    if (!unique.ok) {
      return unique;
    }
    element.effects = structuredClone(changes.effects);
  }

  if (changes.content !== undefined && element.type === 'overlay') {
    element.content = structuredClone(changes.content);
  }

  return { ok: true, value: undefined };
};

export const addLayer = (
  session: StudioSession,
  sceneId: SceneId,
  sourceId: SourceId,
  options: { name?: string; transform?: Partial<Transform2D>; appearance?: Partial<Appearance> } | undefined,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
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

  const source = session.project.sources.find((item) => item.id === sourceId);
  if (!source) {
    return portErr({ kind: 'source-not-found', sourceId });
  }

  const elementId = ctx.generateId();

  const updated = withClonedProject(
    session,
    (project) => {
      const scene = project.scenes.find((item) => item.id === sceneId)!;
      const element = createSourceBackedElement({
        id: elementId,
        source,
        name: options?.name,
        video: project.settings.video,
        transform: options?.transform,
        appearance: options?.appearance,
      });
      scene.elements.push(element);
    },
    ctx,
  );

  if (!updated.ok) {
    return updated;
  }

  if (updated.value.editor.activeSceneId === sceneId) {
    return selectLayer(updated.value, elementId);
  }

  return updated;
};

export const removeLayer = (
  session: StudioSession,
  sceneId: SceneId,
  layerId: ElementId,
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

  const layer = findLayerInScene(scene, layerId);
  if (!layer) {
    return portErr({ kind: 'layer-not-found', sceneId, layerId });
  }

  if (layer.locked) {
    return portErr({
      kind: 'rule-violation',
      rule: 'layer-locked',
      message: 'Cannot remove a locked layer',
    });
  }

  const updated = withClonedProject(
    session,
    (project) => {
      const targetScene = project.scenes.find((item) => item.id === sceneId)!;
      targetScene.elements = targetScene.elements.filter((element) => element.id !== layerId);
      for (const group of targetScene.groups) {
        group.elementIds = group.elementIds.filter((id) => id !== layerId);
      }
      targetScene.groups = targetScene.groups.filter((group) => group.elementIds.length > 0);
    },
    ctx,
  );

  if (!updated.ok) {
    return updated;
  }

  if (updated.value.editor.selectedElementIds.includes(layerId)) {
    return {
      ok: true,
      value: {
        ...updated.value,
        editor: {
          ...updated.value.editor,
          selectedElementIds: updated.value.editor.selectedElementIds.filter((id) => id !== layerId),
          selectedGroupIds: [],
        },
      },
    };
  }

  return updated;
};

const mutateLayerWithoutLockGate = (
  session: StudioSession,
  sceneId: SceneId,
  layerId: ElementId,
  changes: LayerUpdateChanges,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const project = structuredClone(session.project);
  const targetScene = project.scenes.find((item) => item.id === sceneId);
  if (!targetScene) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }

  const element = targetScene.elements.find((item) => item.id === layerId);
  if (!element) {
    return portErr({ kind: 'layer-not-found', sceneId, layerId });
  }

  const applied = applyLayerUpdate(element, changes);
  if (!applied.ok) {
    return applied;
  }

  return commitProjectChange(session, project, ctx);
};

export const renameLayer = (
  session: StudioSession,
  sceneId: SceneId,
  layerId: ElementId,
  name: string,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  return mutateLayerWithoutLockGate(session, sceneId, layerId, { name }, ctx);
};

export const duplicateLayer = (
  session: StudioSession,
  sceneId: SceneId,
  layerId: ElementId,
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

  const sourceIndex = scene.elements.findIndex((element) => element.id === layerId);
  if (sourceIndex === -1) {
    return portErr({ kind: 'layer-not-found', sceneId, layerId });
  }

  const copy = duplicateSceneElement(scene.elements[sourceIndex]!, ctx);
  const copyId = copy.id;

  const updated = withClonedProject(
    session,
    (project) => {
      const targetScene = project.scenes.find((item) => item.id === sceneId)!;
      const index = targetScene.elements.findIndex((element) => element.id === layerId);
      targetScene.elements.splice(index + 1, 0, copy);

      if (copy.parentGroupId) {
        const group = targetScene.groups.find((item) => item.id === copy.parentGroupId);
        if (group) {
          const memberIndex = group.elementIds.indexOf(layerId);
          if (memberIndex === -1) {
            group.elementIds.push(copyId);
          } else {
            group.elementIds.splice(memberIndex + 1, 0, copyId);
          }
        }
      }
    },
    ctx,
  );

  if (!updated.ok) {
    return updated;
  }

  if (updated.value.editor.activeSceneId === sceneId) {
    return selectLayer(updated.value, copyId);
  }

  return updated;
};

export const updateLayer = (
  session: StudioSession,
  sceneId: SceneId,
  layerId: ElementId,
  changes: LayerUpdateChanges,
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

  const existing = findLayerInScene(scene, layerId);
  if (!existing) {
    return portErr({ kind: 'layer-not-found', sceneId, layerId });
  }

  if (existing.locked) {
    const keys = Object.keys(changes);
    if (keys.length !== 1 || keys[0] !== 'locked') {
      return portErr({
        kind: 'rule-violation',
        rule: 'layer-locked',
        message: 'Layer is locked',
      });
    }
  }

  const project = structuredClone(session.project);
  const targetScene = project.scenes.find((item) => item.id === sceneId)!;
  const element = targetScene.elements.find((item) => item.id === layerId)!;
  const applied = applyLayerUpdate(element, changes);
  if (!applied.ok) {
    return applied;
  }

  return commitProjectChange(session, project, ctx);
};

/**
 * Reorders layers within a scene. Index 0 is the bottom of the compositing stack; higher indices draw on top.
 * `targetIndex` is the final array index after the move.
 */
export const moveLayer = (
  session: StudioSession,
  sceneId: SceneId,
  layerId: ElementId,
  targetIndex: number,
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

  const fromIndex = scene.elements.findIndex((element) => element.id === layerId);
  if (fromIndex === -1) {
    return portErr({ kind: 'layer-not-found', sceneId, layerId });
  }

  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= scene.elements.length) {
    return portErr({
      kind: 'invalid-argument',
      message: `targetIndex must be an integer from 0 to ${scene.elements.length - 1}`,
    });
  }

  if (fromIndex === targetIndex) {
    return { ok: true, value: session };
  }

  return moveElementBlock(
    session,
    sceneId,
    [layerId],
    layerId === scene.elements[targetIndex]?.id ? layerId : scene.elements[targetIndex]!.id,
    fromIndex < targetIndex ? 'after' : 'before',
    ctx,
  );
};

/**
 * Moves `elementIds` as one block to sit before or after `anchorElementId`.
 * The anchor must not be part of the block. Member order inside groups follows the scene array.
 */
export const moveElementBlock = (
  session: StudioSession,
  sceneId: SceneId,
  elementIds: ElementId[],
  anchorElementId: ElementId,
  place: 'before' | 'after',
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
    return portErr({ kind: 'invalid-argument', message: 'elementIds cannot be empty' });
  }

  if (uniqueIds.includes(anchorElementId)) {
    return { ok: true, value: session };
  }

  for (const elementId of uniqueIds) {
    if (!findLayerInScene(scene, elementId)) {
      return portErr({ kind: 'layer-not-found', sceneId, layerId: elementId });
    }
  }

  if (!findLayerInScene(scene, anchorElementId)) {
    return portErr({ kind: 'layer-not-found', sceneId, layerId: anchorElementId });
  }

  return withClonedProject(
    session,
    (project) => {
      const targetScene = project.scenes.find((item) => item.id === sceneId)!;
      const moving = new Set(uniqueIds);
      const block = targetScene.elements.filter((element) => moving.has(element.id));
      const rest = targetScene.elements.filter((element) => !moving.has(element.id));
      let index = rest.findIndex((element) => element.id === anchorElementId);
      if (place === 'after') {
        index += 1;
      }
      targetScene.elements = [...rest.slice(0, index), ...block, ...rest.slice(index)];
      syncGroupMemberOrder(targetScene);
    },
    ctx,
  );
};

const syncGroupMemberOrder = (scene: {
  elements: { id: ElementId; parentGroupId: string | null }[];
  groups: { id: string; elementIds: ElementId[] }[];
}) => {
  for (const group of scene.groups) {
    group.elementIds = scene.elements
      .filter((element) => element.parentGroupId === group.id)
      .map((element) => element.id);
  }
  scene.groups = scene.groups.filter((group) => group.elementIds.length > 0);
};

export const setLayerVisibility = (
  session: StudioSession,
  sceneId: SceneId,
  layerId: ElementId,
  visible: boolean,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  return mutateLayerWithoutLockGate(session, sceneId, layerId, { visibility: visible }, ctx);
};

export const removeLayers = (
  session: StudioSession,
  sceneId: SceneId,
  layerIds: ElementId[],
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  let current = session;
  for (const layerId of layerIds) {
    const result = removeLayer(current, sceneId, layerId, ctx);
    if (!result.ok) {
      return result;
    }
    current = result.value;
  }
  return { ok: true, value: current };
};

export const moveLayerRelative = (
  session: StudioSession,
  sceneId: SceneId,
  layerId: ElementId,
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

  const scene = findSceneInProject(session.project, sceneId);
  if (!scene) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }

  const fromIndex = scene.elements.findIndex((element) => element.id === layerId);
  if (fromIndex === -1) {
    return portErr({ kind: 'layer-not-found', sceneId, layerId });
  }

  let targetIndex = fromIndex;
  if (direction === 'up') {
    targetIndex = Math.min(scene.elements.length - 1, fromIndex + 1);
  } else if (direction === 'down') {
    targetIndex = Math.max(0, fromIndex - 1);
  } else if (direction === 'top') {
    targetIndex = scene.elements.length - 1;
  } else {
    targetIndex = 0;
  }

  return moveLayer(session, sceneId, layerId, targetIndex, ctx);
};

export const setLayerLocked = (
  session: StudioSession,
  sceneId: SceneId,
  layerId: ElementId,
  locked: boolean,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  return mutateLayerWithoutLockGate(session, sceneId, layerId, { locked }, ctx);
};
