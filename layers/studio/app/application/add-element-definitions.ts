import { createDefaultAnimationSourceFields } from '../models/source.domain';
import { BROWSER_FRAME_SIZE } from '../schemas/browser-source.schema';
import type { SourceDefinition } from './commands/source-commands';

export type AddElementPanelKey = 'screen' | 'audio' | 'text' | 'shape' | 'image' | 'browser' | 'animation';

export const PLACEHOLDER_PANEL_ASSET_ID = '00000000-0000-4000-8000-000000000001';

export const createSourceDefinitionForPanelKey = (key: AddElementPanelKey, name: string): SourceDefinition => {
  switch (key) {
    case 'screen':
      return { type: 'screen', name };
    case 'audio':
      return { type: 'audio', name };
    case 'text':
      return { type: 'text', name, content: '' };
    case 'shape':
      return { type: 'shape', name, shapeKind: 'rect' };
    case 'image':
      return { type: 'image', name, assetId: PLACEHOLDER_PANEL_ASSET_ID };
    case 'browser':
      return {
        type: 'browser',
        name,
        url: '',
        width: BROWSER_FRAME_SIZE,
        height: BROWSER_FRAME_SIZE,
        refreshSettings: {
          intervalMs: null,
          refreshOnActivate: true,
          bypassCache: false,
        },
      };
    case 'animation':
      return {
        type: 'animation',
        name,
        ...createDefaultAnimationSourceFields('gif'),
      };
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
};
