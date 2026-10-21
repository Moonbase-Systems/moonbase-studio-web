import type { SceneAnimation } from './animation.domain';
import type { Appearance, ElementEffect, Transform2D } from './common.domain';
import type { ElementId, GroupId, SourceId } from './ids.domain';
import type { ProjectVideoSettings } from './project.domain';
import type { Source } from './source.domain';

export type OverlayKind = 'lower-third' | 'alert' | 'counter' | 'custom' | (string & {});

export type OverlayContent = Record<string, unknown>;

type SceneElementBase = {
  id: ElementId;
  name: string;
  parentGroupId: GroupId | null;
  transform: Transform2D;
  appearance: Appearance;
  effects: ElementEffect[];
  visibility: boolean;
  locked: boolean;
};

export type SourceBackedElementType =
  | 'camera'
  | 'screen'
  | 'image'
  | 'video'
  | 'text'
  | 'shape'
  | 'browser'
  | 'audioVisual';

export type SourceBackedElement = SceneElementBase & {
  type: SourceBackedElementType;
  sourceId: SourceId;
};

export type OverlayElement = SceneElementBase & {
  type: 'overlay';
  overlayKind: OverlayKind;
  content: OverlayContent;
  animations: SceneAnimation[];
};

export type SceneElement = SourceBackedElement | OverlayElement;

export type SceneElementType = SceneElement['type'];

/** Maps project source types to scene element types (`audio` → `audioVisual`). */
export const elementTypeForSource = (source: Source): SourceBackedElementType => {
  if (source.type === 'audio') {
    return 'audioVisual';
  }
  return source.type as SourceBackedElementType;
};

export const createDefaultElementTransform = (video: ProjectVideoSettings): Transform2D => ({
  x: 0,
  y: 0,
  width: video.width,
  height: video.height,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
});

export const createSourceBackedElement = (input: {
  id: ElementId;
  source: Source;
  name?: string;
  video: ProjectVideoSettings;
  transform?: Partial<Transform2D>;
  appearance?: Partial<Appearance>;
}): SourceBackedElement => {
  const transform = {
    ...createDefaultElementTransform(input.video),
    ...input.transform,
  };

  return {
    id: input.id,
    name: input.name ?? input.source.name,
    type: elementTypeForSource(input.source),
    sourceId: input.source.id,
    parentGroupId: null,
    transform,
    appearance: { opacity: 1, ...input.appearance },
    effects: [],
    visibility: true,
    locked: false,
  };
};
