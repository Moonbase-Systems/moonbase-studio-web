import type { ChannelId, EffectId, SourceId } from './ids.domain';

export type AudioMaster = {
  volume: number;
  muted: boolean;
};

export type AudioFilter = {
  id: EffectId;
  type: string;
  enabled: boolean;
  parameters: Record<string, unknown>;
};

export type AudioEffect = {
  id: EffectId;
  type: string;
  enabled: boolean;
  parameters: Record<string, unknown>;
};

export type AudioChannel = {
  id: ChannelId;
  name: string;
  sourceId: SourceId | null;
  volume: number;
  muted: boolean;
  solo: boolean;
  pan: number;
  filters: AudioFilter[];
  effects: AudioEffect[];
};

export type AudioMixer = {
  master: AudioMaster;
  channels: AudioChannel[];
};

export const createDefaultAudioMixer = (): AudioMixer => ({
  master: { volume: 1, muted: false },
  channels: [],
});
