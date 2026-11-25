import type { OverlayContent } from '../../models/scene-elements/overlay-element.domain';

/** Shown inside the layer rectangle. The editor iframe stays; its pixels are not read. */
export const BROWSER_PLATE_CAPTION = 'Browser nie wchodzi do nagrania';

export type LayerDrawKind =
  | 'shape'
  | 'text'
  | 'image'
  | 'screen'
  | 'browser-plate'
  | 'camera'
  | 'video'
  | 'animation'
  | 'overlay'
  | 'audio-visual'
  | 'placeholder';

/** What the scene graph draws for a layer. Browser is an explicit plate, never a silent skip. */
export const layerDrawKind = (type: string): LayerDrawKind => {
  switch (type) {
    case 'shape':
    case 'text':
    case 'image':
    case 'screen':
    case 'camera':
    case 'video':
    case 'animation':
    case 'overlay':
      return type;
    case 'browser':
      return 'browser-plate';
    case 'audioVisual':
      return 'audio-visual';
    default:
      return 'placeholder';
  }
};

const OVERLAY_TEXT_KEYS = ['text', 'title', 'message', 'body', 'name', 'label'] as const;

/** First authored string on an overlay. Empty when the content has none. */
export const overlayText = (content: OverlayContent): string => {
  for (const key of OVERLAY_TEXT_KEYS) {
    const value = content[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};
