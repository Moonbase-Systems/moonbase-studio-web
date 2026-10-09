import type { Appearance, Transform2D } from './common.domain';
import type { ElementId, GroupId } from './ids.domain';

export type SceneGroup = {
  id: GroupId;
  name: string;
  type: string;
  /** Ordered members; must match elements with parentGroupId === id. */
  elementIds: ElementId[];
  transform: Transform2D;
  appearance: Appearance;
};
