import { buildSceneListRoots } from '../../application/scene-list-tree';
import type { ElementId, GroupId } from '../../models/ids.domain';
import type { Scene } from '../../models/scene.domain';
import type { SceneElement } from '../../models/scene-element.domain';
import type { SceneGroup } from '../../models/scene-group.domain';

export type CompositionRoot =
  | { kind: 'element'; element: SceneElement }
  | { kind: 'group'; group: SceneGroup; members: SceneElement[] };

export type SceneSyncIssue = {
  elementId?: ElementId;
  groupId?: GroupId;
  message: string;
};

export type RenderedSceneIds = {
  elementIds: ReadonlySet<ElementId>;
  groupIds: ReadonlySet<GroupId>;
};

export type SceneSyncPlan = {
  /** Bottom-to-top; group members follow `group.elementIds`. */
  roots: CompositionRoot[];
  elementIds: Set<ElementId>;
  groupIds: Set<GroupId>;
  removedElementIds: ElementId[];
  removedGroupIds: GroupId[];
  issues: SceneSyncIssue[];
};

/** Audio layers occupy a slot in `scene.elements` but draw nothing. */
export const isRenderableElement = (element: SceneElement): boolean => element.type !== 'audioVisual';

export const planSceneSync = (scene: Scene, rendered: RenderedSceneIds): SceneSyncPlan => {
  const elementById = new Map(scene.elements.map((element) => [element.id, element]));
  const groupById = new Map(scene.groups.map((group) => [group.id, group]));
  const issues: SceneSyncIssue[] = [];
  const roots: CompositionRoot[] = [];
  const elementIds = new Set<ElementId>();
  const groupIds = new Set<GroupId>();

  for (const root of buildSceneListRoots(scene)) {
    if (root.kind === 'element') {
      if (isRenderableElement(root.element)) {
        roots.push(root);
        elementIds.add(root.element.id);
      }
      continue;
    }

    const members: SceneElement[] = [];
    for (const memberId of root.group.elementIds) {
      const member = elementById.get(memberId);
      if (member && member.parentGroupId === root.group.id && isRenderableElement(member)) {
        members.push(member);
        elementIds.add(member.id);
      }
    }
    roots.push({ kind: 'group', group: root.group, members });
    groupIds.add(root.group.id);
  }

  for (const group of scene.groups) {
    for (const memberId of group.elementIds) {
      const member = elementById.get(memberId);
      if (!member) {
        issues.push({
          groupId: group.id,
          elementId: memberId,
          message: `Group ${group.id} lists missing element ${memberId}`,
        });
      } else if (member.parentGroupId !== group.id) {
        issues.push({
          groupId: group.id,
          elementId: memberId,
          message: `Group ${group.id} lists element ${memberId} that belongs to ${member.parentGroupId ?? 'no group'}`,
        });
      }
    }
  }

  for (const element of scene.elements) {
    if (!element.parentGroupId) {
      continue;
    }
    const group = groupById.get(element.parentGroupId);
    if (!group) {
      issues.push({
        elementId: element.id,
        groupId: element.parentGroupId,
        message: `Element ${element.id} references missing group ${element.parentGroupId}`,
      });
      continue;
    }
    if (!group.elementIds.includes(element.id)) {
      issues.push({
        elementId: element.id,
        groupId: group.id,
        message: `Element ${element.id} is not listed in group ${group.id}`,
      });
    }
  }

  return {
    roots,
    elementIds,
    groupIds,
    removedElementIds: [...rendered.elementIds].filter((id) => !elementIds.has(id)),
    removedGroupIds: [...rendered.groupIds].filter((id) => !groupIds.has(id)),
    issues,
  };
};

/**
 * Changes when the drawn content must be rebuilt (Graphics path, Text style, texture frame).
 * Position, scale, rotation, opacity, visibility and blend mode are applied in place and stay out of the key.
 * Images and screens leave the box size and crop out too: the engine re-fits loaded media to them in place.
 * Screen `showCursor` is applied with `applyConstraints` on the live track, so it stays out of the key —
 * rebuilding would tear down the video element and show a black frame after a minimised window returns.
 */
export const elementContentKey = (element: SceneElement, resolvedImageUrl: string | null = null): string => {
  const size = [element.transform.width, element.transform.height];
  switch (element.type) {
    case 'shape':
    case 'text':
      return JSON.stringify([element.type, size, element.settings]);
    case 'image':
      return JSON.stringify([element.type, element.settings, resolvedImageUrl]);
    case 'screen': {
      const { showCursor: _showCursor, ...drawnSettings } = element.settings;
      return JSON.stringify([element.type, drawnSettings, resolvedImageUrl]);
    }
    default:
      return JSON.stringify([element.type, size, element.name]);
  }
};
