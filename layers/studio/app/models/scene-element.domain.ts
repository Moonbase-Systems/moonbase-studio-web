import type { SceneAnimation } from './animation.domain';
import type { Appearance, ElementEffect, Transform2D } from './common.domain';
import type { ElementId, GroupId, SourceId } from './ids.domain';

export type OverlayKind = 'lower-third' | 'alert' | 'counter' | 'custom' | (string & {});

export type OverlayContent = Record<string, unknown>;

type SceneElementBase = {
  id: ElementId;
  parentGroupId: GroupId | null;
  transform: Transform2D;
  appearance: Appearance;
  effects: ElementEffect[];
  visibility: boolean;
  zIndex: number;
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
