import type { ElementId, GroupId } from '../models/ids.domain';
import type { Scene } from '../models/scene.domain';
import type { SceneElement } from '../models/scene-element.domain';
import type { SceneGroup } from '../models/scene-group.domain';

export type SceneListRootNode = { kind: 'element'; element: SceneElement } | { kind: 'group'; group: SceneGroup };

export const buildSceneListRoots = (scene: Scene): SceneListRootNode[] => {
  const groupById = new Map(scene.groups.map((group) => [group.id, group]));
  const elementIndex = new Map(scene.elements.map((element, index) => [element.id, index]));
  const seenGroups = new Set<GroupId>();
  const roots: SceneListRootNode[] = [];

  for (const element of scene.elements) {
    if (element.parentGroupId) {
      if (!seenGroups.has(element.parentGroupId)) {
        seenGroups.add(element.parentGroupId);
        const group = groupById.get(element.parentGroupId);
        if (group) {
          roots.push({ kind: 'group', group });
        }
      }
      continue;
    }

    roots.push({ kind: 'element', element });
  }

  roots.sort((left, right) => {
    const leftIndex =
      left.kind === 'element'
        ? (elementIndex.get(left.element.id) ?? 0)
        : Math.min(...left.group.elementIds.map((id) => elementIndex.get(id) ?? 0));
    const rightIndex =
      right.kind === 'element'
        ? (elementIndex.get(right.element.id) ?? 0)
        : Math.min(...right.group.elementIds.map((id) => elementIndex.get(id) ?? 0));
    return leftIndex - rightIndex;
  });

  return roots;
};

export const flattenSelectableElementIds = (scene: Scene, roots: SceneListRootNode[]): ElementId[] => {
  const ordered: ElementId[] = [];

  for (const root of roots) {
    if (root.kind === 'element') {
      ordered.push(root.element.id);
      continue;
    }

    for (const elementId of root.group.elementIds) {
      ordered.push(elementId);
    }
  }

  return ordered;
};

export const findElementInScene = (scene: Scene, elementId: ElementId): SceneElement | undefined =>
  scene.elements.find((element) => element.id === elementId);
