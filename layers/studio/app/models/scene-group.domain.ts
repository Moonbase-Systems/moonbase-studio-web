import type { Appearance, Transform2D } from './common.domain';
import type { ElementId, GroupId } from './ids.domain';
import type { ProjectVideoSettings } from './project.domain';
import { createDefaultElementTransform } from './scene-element.domain';

export type SceneGroup = {
  id: GroupId;
  name: string;
  type: string;
  /** Ordered members; must match elements with parentGroupId === id. */
  elementIds: ElementId[];
  transform: Transform2D;
  appearance: Appearance;
};

export const createSceneGroup = (input: {
  id: GroupId;
  name: string;
  elementIds: ElementId[];
  video: ProjectVideoSettings;
  type?: string;
}): SceneGroup => ({
  id: input.id,
  name: input.name,
  type: input.type ?? 'group',
  elementIds: [...input.elementIds],
  transform: createDefaultElementTransform(input.video),
  appearance: { opacity: 1 },
});
