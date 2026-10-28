import type { SourceId } from '../ids.domain';
import type { SceneElementBase } from './scene-element-base.domain';
import { createDefaultVisualFitSettings, type VisualFitSettings } from './visual-element-settings.domain';

export type ImageElementSettings = VisualFitSettings & {
  smoothing: boolean;
};

export type ImageElement = SceneElementBase & {
  type: 'image';
  sourceId: SourceId;
  settings: ImageElementSettings;
};

export const createDefaultImageElementSettings = (): ImageElementSettings => ({
  ...createDefaultVisualFitSettings(),
  smoothing: true,
});
