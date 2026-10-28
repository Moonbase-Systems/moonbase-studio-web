import type { SourceId } from '../ids.domain';
import type { SceneElementBase } from './scene-element-base.domain';

export type AudioMonitoringMode = 'off' | 'monitor' | 'monitor-and-output';

export type AudioElementSettings = {
  volume: number;
  muted: boolean;
  pan: number;
  syncOffsetMs: number;
  monitoring: AudioMonitoringMode;
};

export type AudioVisualElement = SceneElementBase & {
  type: 'audioVisual';
  sourceId: SourceId;
  settings: AudioElementSettings;
};

export const createDefaultAudioElementSettings = (): AudioElementSettings => ({
  volume: 1,
  muted: false,
  pan: 0,
  syncOffsetMs: 0,
  monitoring: 'off',
});
