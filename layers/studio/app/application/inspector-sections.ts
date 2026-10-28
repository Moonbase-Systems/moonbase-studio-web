import type { SceneElementType } from '../models/scene-element.domain';

/** Content blocks rendered inside a property card tab. */
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

export type InspectorTabId = string;

export type InspectorTabDefinition = {
  id: InspectorTabId;
  labelKey: string;
  panels: InspectorPanelId[];
};

const standardVisualTabs = (): InspectorTabDefinition[] => [
  {
    id: 'visual',
    labelKey: 'studio.properties.tabs.visual',
    panels: ['visualFit'],
  },
  {
    id: 'crop',
    labelKey: 'studio.properties.tabs.crop',
    panels: ['crop'],
  },
  {
    id: 'transform',
    labelKey: 'studio.properties.tabs.transform',
    panels: ['transform', 'appearance'],
  },
  {
    id: 'effects',
    labelKey: 'studio.properties.tabs.effects',
    panels: ['effects'],
  },
];

export const inspectorTabsForElementType = (type: SceneElementType): InspectorTabDefinition[] => {
  switch (type) {
    case 'text':
      return [
        {
          id: 'text',
          labelKey: 'studio.properties.tabs.text',
          panels: ['textPrimary'],
        },
        {
          id: 'layout',
          labelKey: 'studio.properties.tabs.layout',
          panels: ['textLayout'],
        },
        {
          id: 'transformCrop',
          labelKey: 'studio.properties.tabs.transformCrop',
          panels: ['transform', 'crop', 'appearance'],
        },
        {
          id: 'strokeFill',
          labelKey: 'studio.properties.tabs.strokeFill',
          panels: ['textStrokeFill'],
        },
      ];
    case 'video':
      return [
        {
          id: 'playback',
          labelKey: 'studio.properties.tabs.playback',
          panels: ['videoPlayback'],
        },
        {
          id: 'visual',
          labelKey: 'studio.properties.tabs.visual',
          panels: ['visualFit', 'crop'],
        },
        {
          id: 'transform',
          labelKey: 'studio.properties.tabs.transform',
          panels: ['transform', 'appearance'],
        },
        {
          id: 'effects',
          labelKey: 'studio.properties.tabs.effects',
          panels: ['effects'],
        },
      ];
    case 'image':
      return standardVisualTabs();
    case 'camera':
      return standardVisualTabs();
    case 'screen':
      return standardVisualTabs();
    case 'shape':
      return [
        {
          id: 'shape',
          labelKey: 'studio.properties.tabs.shape',
          panels: ['shapePrimary'],
        },
        {
          id: 'transform',
          labelKey: 'studio.properties.tabs.transform',
          panels: ['transform', 'appearance', 'crop'],
        },
      ];
    case 'audioVisual':
      return [
        {
          id: 'mix',
          labelKey: 'studio.properties.tabs.mix',
          panels: ['audioMix'],
        },
        {
          id: 'sync',
          labelKey: 'studio.properties.tabs.sync',
          panels: ['audioSync'],
        },
      ];
    case 'browser':
    case 'animation':
      return [
        {
          id: 'source',
          labelKey: 'studio.properties.tabs.source',
          panels: ['sourceReadonly'],
        },
        {
          id: 'transform',
          labelKey: 'studio.properties.tabs.transform',
          panels: ['transform', 'appearance', 'crop'],
        },
        {
          id: 'effects',
          labelKey: 'studio.properties.tabs.effects',
          panels: ['effects'],
        },
      ];
    case 'overlay':
      return [
        {
          id: 'transform',
          labelKey: 'studio.properties.tabs.transform',
          panels: ['transform', 'appearance', 'crop'],
        },
        {
          id: 'effects',
          labelKey: 'studio.properties.tabs.effects',
          panels: ['effects'],
        },
      ];
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
};

export const inspectorShowsVisualSections = (type: SceneElementType): boolean => type !== 'audioVisual';
