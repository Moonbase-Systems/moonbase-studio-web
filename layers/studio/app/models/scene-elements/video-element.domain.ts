import type { SourceId } from '../ids.domain';
import type { SceneElementBase } from './scene-element-base.domain';
import { createDefaultVisualFitSettings, type VisualFitSettings } from './visual-element-settings.domain';

export type VideoElementSettings = VisualFitSettings & {
  loop: boolean;
  autoplay: boolean;
  restartOnSceneActivate: boolean;
  playbackRate: number;
  muted: boolean;
  volume: number;
  startTime: number;
  endTime: number | null;
};

export type VideoElement = SceneElementBase & {
  type: 'video';
  sourceId: SourceId;
  settings: VideoElementSettings;
};

export const createDefaultVideoElementSettings = (sourceLoop?: boolean): VideoElementSettings => ({
  ...createDefaultVisualFitSettings(),
  loop: sourceLoop ?? false,
  autoplay: true,
  restartOnSceneActivate: false,
  playbackRate: 1,
  muted: false,
  volume: 1,
  startTime: 0,
  endTime: null,
});
