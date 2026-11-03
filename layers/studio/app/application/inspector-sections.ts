import type { SceneElementType } from '../models/scene-element.domain';

/** Content blocks rendered inside a property card. */
export type InspectorPanelId =
  | 'textPrimary'
  | 'textLayout'
  | 'textStrokeFill'
  | 'visualFit'
  | 'videoPlayback'
  | 'shapePrimary'
  | 'audioMix'
  | 'audioSync'
  | 'transform'
  | 'crop'
  | 'appearance'
  | 'effects'
  | 'sourceReadonly';

export type InspectorRailId = 'source' | 'transform' | 'effects';

export type InspectorRailDefinition = {
  id: InspectorRailId;
  labelKey: string;
};

const visualRails = (): InspectorRailDefinition[] => [
  {
    id: 'source',
    labelKey: 'studio.properties.rails.source',
  },
  {
    id: 'transform',
    labelKey: 'studio.properties.rails.transform',
  },
  {
    id: 'effects',
    labelKey: 'studio.properties.rails.effects',
  },
];

export const inspectorRailsForElementType = (type: SceneElementType): InspectorRailDefinition[] => {
  switch (type) {
    case 'audioVisual':
      return [
        {
          id: 'source',
          labelKey: 'studio.properties.rails.audio',
        },
        {
          id: 'effects',
          labelKey: 'studio.properties.rails.filters',
        },
      ];
    case 'text':
      return visualRails().filter((rail) => rail.id !== 'effects');
    case 'shape':
      return [
        {
          id: 'source',
          labelKey: 'studio.properties.rails.shape',
        },
        {
          id: 'transform',
          labelKey: 'studio.properties.rails.transform',
        },
      ];
    case 'animation':
      return [
        {
          id: 'source',
          labelKey: 'studio.properties.rails.animation',
        },
        {
          id: 'transform',
          labelKey: 'studio.properties.rails.transform',
        },
      ];
    case 'overlay':
      return visualRails().filter((rail) => rail.id !== 'source');
    default:
      return visualRails();
  }
};

export const inspectorPanelsForRail = (type: SceneElementType, railId: InspectorRailId): InspectorPanelId[] => {
  if (railId === 'transform') {
    return ['transform'];
  }
  if (railId === 'effects') {
    return ['effects'];
  }

  switch (type) {
    case 'text':
      return ['textPrimary'];
    case 'screen':
    case 'image':
    case 'camera':
      return ['visualFit'];
    case 'video':
      return ['videoPlayback'];
    case 'shape':
      return ['shapePrimary'];
    case 'audioVisual':
      return ['audioMix'];
    case 'browser':
    case 'animation':
      return ['sourceReadonly'];
    case 'overlay':
      return [];
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
};

export const inspectorCardTitleForRail = (railId: InspectorRailId, type: SceneElementType): string => {
  if (railId === 'transform') {
    return 'studio.properties.cardTitles.transformation';
  }
  if (railId === 'effects') {
    return type === 'audioVisual' ? 'studio.properties.cardTitles.filters' : 'studio.properties.cardTitles.effects';
  }
  switch (type) {
    case 'text':
      return 'studio.properties.cardTitles.text';
    case 'screen':
      return 'studio.properties.cardTitles.screen';
    case 'camera':
      return 'studio.properties.cardTitles.camera';
    case 'image':
      return 'studio.properties.cardTitles.image';
    case 'video':
      return 'studio.properties.cardTitles.video';
    case 'shape':
      return 'studio.properties.cardTitles.shape';
    case 'audioVisual':
      return 'studio.properties.cardTitles.audio';
    case 'browser':
      return 'studio.properties.cardTitles.browser';
    case 'animation':
      return 'studio.properties.cardTitles.animation';
    default:
      return 'studio.properties.cardTitles.screen';
  }
};
