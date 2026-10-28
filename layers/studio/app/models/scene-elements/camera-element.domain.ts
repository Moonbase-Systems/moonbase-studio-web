import type { SourceId } from '../ids.domain';
import type { SceneElementBase } from './scene-element-base.domain';
import { createDefaultVisualFitSettings, type VisualFitSettings } from './visual-element-settings.domain';

export type CameraElementSettings = VisualFitSettings & {
  mirror: boolean;
  preferredAspectRatio: string | null;
};

export type CameraElement = SceneElementBase & {
  type: 'camera';
  sourceId: SourceId;
  settings: CameraElementSettings;
};

export const createDefaultCameraElementSettings = (): CameraElementSettings => ({
  ...createDefaultVisualFitSettings(),
  mirror: false,
  preferredAspectRatio: null,
});
