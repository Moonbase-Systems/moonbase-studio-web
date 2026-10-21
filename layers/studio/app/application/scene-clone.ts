import type { SceneAnimation } from '../models/animation.domain';
import type { ElementEffect } from '../models/common.domain';
import type { Scene } from '../models/scene.domain';
import type { SceneElement } from '../models/scene-element.domain';
import type { CommandContext } from './context';

const assignNewEffectIds = (effects: ElementEffect[], ctx: CommandContext): ElementEffect[] =>
  effects.map((effect) => ({
    ...structuredClone(effect),
    id: ctx.generateId(),
  }));

const assignNewAnimationIds = (animations: SceneAnimation[], ctx: CommandContext): SceneAnimation[] =>
  animations.map((animation) => ({
    ...structuredClone(animation),
    id: ctx.generateId(),
  }));

const cloneSceneAnimation = (animation: SceneAnimation | null, ctx: CommandContext): SceneAnimation | null => {
  if (!animation) {
    return null;
  }
  return {
    ...structuredClone(animation),
    id: ctx.generateId(),
  };
};

export const duplicateSceneElement = (element: SceneElement, ctx: CommandContext): SceneElement => {
  const clone = structuredClone(element);
  clone.id = ctx.generateId();
  clone.name = `${element.name} copy`;
  clone.effects = assignNewEffectIds(element.effects, ctx);

  if (clone.type === 'overlay' && element.type === 'overlay') {
    clone.animations = assignNewAnimationIds(element.animations, ctx);
  }

  return clone;
};

/**
 * Deep-clones a scene with new ids for the scene, groups, elements, effects, and overlay/scene animations.
 * Shared source and asset references are preserved.
 */
export const duplicateSceneWithNewIds = (scene: Scene, ctx: CommandContext): Scene => {
  const idMap = new Map<string, string>();

  const mapId = (oldId: string): string => {
    let mapped = idMap.get(oldId);
    if (!mapped) {
      mapped = ctx.generateId();
      idMap.set(oldId, mapped);
    }
    return mapped;
  };

  mapId(scene.id);
  for (const group of scene.groups) {
    mapId(group.id);
  }
  for (const element of scene.elements) {
    mapId(element.id);
  }

  const elements: SceneElement[] = scene.elements.map((element) => {
    const cloned = duplicateSceneElement(element, ctx);
    cloned.id = idMap.get(element.id)!;
    cloned.parentGroupId = element.parentGroupId ? (idMap.get(element.parentGroupId) ?? null) : null;
    return cloned;
  });

  const groups = scene.groups.map((group) => ({
    ...structuredClone(group),
    id: idMap.get(group.id)!,
    elementIds: group.elementIds.map((elementId) => idMap.get(elementId)!),
  }));

  return {
    ...structuredClone(scene),
    id: idMap.get(scene.id)!,
    name: `${scene.name} copy`,
    elements,
    groups,
    animations: {
      onEnter: cloneSceneAnimation(scene.animations.onEnter, ctx),
      onExit: cloneSceneAnimation(scene.animations.onExit, ctx),
    },
  };
};
