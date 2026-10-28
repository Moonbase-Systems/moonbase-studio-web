import type { SceneElementType } from '../../models/scene-element.domain';

export type SceneListRowIconKind = SceneElementType;

export type SceneElementIconTone = 'accent' | 'layout' | 'interactive';

export const sceneElementTypeIconName = (kind: SceneListRowIconKind): string => {
  switch (kind) {
    case 'camera':
      return 'mdi:webcam';
    case 'screen':
      return 'mdi:monitor';
    case 'image':
      return 'mdi:image-outline';
    case 'video':
      return 'mdi:filmstrip';
    case 'text':
      return 'mdi:format-text';
    case 'shape':
      return 'mdi:shape-outline';
    case 'browser':
      return 'mdi:web';
    case 'audioVisual':
      return 'mdi:volume-high';
    case 'animation':
      return 'mdi:animation-play-outline';
    case 'overlay':
      return 'mdi:layers-outline';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

/** Matches add-panel categories: core → accent, layout → blue, interactive → pink. */
export const sceneElementTypeTone = (kind: SceneListRowIconKind): SceneElementIconTone => {
  switch (kind) {
    case 'camera':
    case 'screen':
    case 'audioVisual':
      return 'accent';
    case 'text':
    case 'shape':
    case 'image':
    case 'video':
      return 'layout';
    case 'browser':
    case 'animation':
    case 'overlay':
      return 'interactive';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

export const sceneElementTypeIconI18nKey = (kind: SceneListRowIconKind): string => `studio.scene.elementIcon.${kind}`;
