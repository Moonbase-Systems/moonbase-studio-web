import type { SourceDefinition } from './commands/source-commands';

export type AddElementPanelKey = 'screen' | 'audio' | 'text' | 'shape' | 'image' | 'browser' | 'animation';

const PLACEHOLDER_ASSET_ID = '00000000-0000-4000-8000-000000000001';

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
      return { type: 'image', name, assetId: PLACEHOLDER_ASSET_ID };
    case 'browser':
      return {
        type: 'browser',
        name,
        url: 'https://example.com',
        width: 1920,
        height: 1080,
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
        mediaKind: 'gif',
        startFrame: 0,
        startOffsetMs: 0,
        durationMs: null,
        trigger: 'manual',
        intervalMs: null,
      };
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
};
