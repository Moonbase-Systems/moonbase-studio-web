import type { SceneAnimation } from '../animation.domain';
import type { SceneElementBase } from './scene-element-base.domain';

export type OverlayKind = 'lower-third' | 'alert' | 'counter' | 'custom' | (string & {});

export type OverlayContent = Record<string, unknown>;

export type OverlayElement = SceneElementBase & {
  type: 'overlay';
  overlayKind: OverlayKind;
  content: OverlayContent;
  animations: SceneAnimation[];
};
