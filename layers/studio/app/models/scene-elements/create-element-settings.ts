import type { Source } from '../source.domain';
import { createDefaultAnimationElementSettings } from './animation-element.domain';
import { createDefaultAudioElementSettings } from './audio-element.domain';
import { createDefaultBrowserElementSettings } from './browser-element.domain';
import { createDefaultCameraElementSettings } from './camera-element.domain';
import { createDefaultImageElementSettings } from './image-element.domain';
import { createDefaultScreenElementSettings } from './screen-element.domain';
import { createDefaultShapeElementSettings, shapeKindToShapeType } from './shape-element.domain';
import { createDefaultTextElementSettings } from './text-element.domain';
import { createDefaultVideoElementSettings } from './video-element.domain';

export const createDefaultSettingsForSource = (source: Source) => {
  switch (source.type) {
    case 'camera':
      return createDefaultCameraElementSettings();
    case 'screen':
      return createDefaultScreenElementSettings();
    case 'image':
      return createDefaultImageElementSettings();
    case 'video':
      return createDefaultVideoElementSettings(source.loop);
    case 'text':
      return createDefaultTextElementSettings(source.content);
    case 'shape':
      return createDefaultShapeElementSettings(shapeKindToShapeType(source.shapeKind));
    case 'audio':
      return createDefaultAudioElementSettings();
    case 'browser':
      return createDefaultBrowserElementSettings();
    case 'animation':
      return createDefaultAnimationElementSettings();
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
};
