import type { ChannelId } from '../ids.domain';
import type { SceneElementBase } from './scene-element-base.domain';

export type AudioElementSettings = Record<string, never>;

export type AudioVisualElement = SceneElementBase & {
  type: 'audioVisual';
  channelId: ChannelId;
  settings: AudioElementSettings;
};

export const createDefaultAudioElementSettings = (): AudioElementSettings => ({});
