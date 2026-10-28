import type { SourceId } from '../ids.domain';
import type { SceneElementBase } from './scene-element-base.domain';
import { createDefaultVisualFitSettings, type VisualFitSettings } from './visual-element-settings.domain';

export type ScreenElementSettings = VisualFitSettings & {
  showCursor: boolean;
};

export type ScreenElement = SceneElementBase & {
  type: 'screen';
  sourceId: SourceId;
  settings: ScreenElementSettings;
};

export const createDefaultScreenElementSettings = (): ScreenElementSettings => ({
  ...createDefaultVisualFitSettings(),
  showCursor: true,
});
