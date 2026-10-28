import type { Appearance, ElementCrop, ElementEffect, Transform2D } from '../common.domain';
import { createDefaultElementCrop } from '../common.domain';
import type { ElementId, GroupId } from '../ids.domain';
import type { ProjectVideoSettings } from '../project.domain';

export type SceneElementBase = {
  id: ElementId;
  name: string;
  parentGroupId: GroupId | null;
  transform: Transform2D;
  crop: ElementCrop;
  appearance: Appearance;
  effects: ElementEffect[];
  visibility: boolean;
  locked: boolean;
};

export const createDefaultElementTransform = (video: ProjectVideoSettings): Transform2D => ({
  x: 0,
  y: 0,
  width: video.width,
  height: video.height,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  anchorX: 0,
  anchorY: 0,
  flipX: false,
  flipY: false,
  keepAspectRatio: false,
});

export const createSceneElementBaseFields = (input: {
  id: ElementId;
  name: string;
  video: ProjectVideoSettings;
  transform?: Partial<Transform2D>;
  appearance?: Partial<Appearance>;
}): Omit<SceneElementBase, never> => ({
  id: input.id,
  name: input.name,
  parentGroupId: null,
  transform: {
    ...createDefaultElementTransform(input.video),
    ...input.transform,
  },
  crop: createDefaultElementCrop(),
  appearance: { opacity: 1, ...input.appearance },
  effects: [],
  visibility: true,
  locked: false,
});
