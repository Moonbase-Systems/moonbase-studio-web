import type { AudioEffect } from './audio-effect.domain';
import type { AudioUserPreset } from './audio-preset.domain';
import type { ChannelId, EffectId, SourceId } from './ids.domain';
import type { OverlayBus } from './overlay-sound.domain';
import { createDefaultOverlayBus } from './overlay-sound.domain';

export type { AudioEffect } from './audio-effect.domain';

export type AudioMonitoringMode = 'off' | 'monitor' | 'monitor-and-output';

export type AudioMaster = {
  volume: number;
  muted: boolean;
  effects: AudioEffect[];
};

export type AudioFilter = {
  id: EffectId;
  type: string;
  enabled: boolean;
  parameters: Record<string, unknown>;
};

/** Pre-fader trim. Independent of the channel fader. */
export const TRIM_DB_MIN = -24;
export const TRIM_DB_MAX = 24;

/** Channel fader. Unity is 0 dB. The floor is silence for a closed fader, not mute. */
export const FADER_DB_MIN = -60;
export const FADER_DB_MAX = 12;

/** Lip-sync nudge. One second either way is enough to line a voice up with a picture. */
export const SYNC_OFFSET_MS_MIN = -1000;
export const SYNC_OFFSET_MS_MAX = 1000;

export const LEVEL_FLOOR_DB = -60;

export type AudioChannel = {
  id: ChannelId;
  name: string;
  sourceIds: SourceId[];
  trimDb: number;
  faderDb: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  monitoring: AudioMonitoringMode;
  /** Stored for a later delay stage. The browser graph does not apply it yet. */
  syncOffsetMs: number;
  /** Heard on every scene. A scene layer for the same source reuses this channel. */
  global: boolean;
  filters: AudioFilter[];
  effects: AudioEffect[];
};

export type AudioMixer = {
  master: AudioMaster;
  channels: AudioChannel[];
  presets: AudioUserPreset[];
  overlay: OverlayBus;
};

export const createDefaultAudioChannel = (input: {
  id: ChannelId;
  name: string;
  sourceIds?: SourceId[];
}): AudioChannel => ({
  id: input.id,
  name: input.name,
  sourceIds: input.sourceIds ? [...input.sourceIds] : [],
  trimDb: 0,
  faderDb: 0,
  pan: 0,
  muted: false,
  solo: false,
  monitoring: 'off',
  syncOffsetMs: 0,
  filters: [],
  global: false,
  effects: [],
});

export const createDefaultAudioMixer = (): AudioMixer => ({
  master: { volume: 1, muted: false, effects: [] },
  channels: [],
  presets: [],
  overlay: createDefaultOverlayBus(),
});

export const dbToGain = (db: number): number => 10 ** (db / 20);

export const amplitudeToDb = (amplitude: number): number => {
  if (!(amplitude > 0)) {
    return LEVEL_FLOOR_DB;
  }
  return Math.max(LEVEL_FLOOR_DB, 20 * Math.log10(amplitude));
};

/** Maps a legacy linear fader (0…1, unity at 1) onto faderDb. */
export const volumeToFaderDb = (volume: number): number => {
  if (!(volume > 0)) {
    return FADER_DB_MIN;
  }
  const db = 20 * Math.log10(volume);
  const clamped = Math.min(FADER_DB_MAX, Math.max(FADER_DB_MIN, db));
  return Math.round(clamped * 100) / 100;
};

export const normalizeLevelDb = (db: number): number => {
  const clamped = Math.min(0, Math.max(LEVEL_FLOOR_DB, db));
  return (clamped - LEVEL_FLOOR_DB) / -LEVEL_FLOOR_DB;
};

export const measureTimeDomain = (samples: ArrayLike<number>): { rmsDb: number; peakDb: number } => {
  const length = samples.length;
  if (length === 0) {
    return { rmsDb: LEVEL_FLOOR_DB, peakDb: LEVEL_FLOOR_DB };
  }
  let sum = 0;
  let peak = 0;
  for (let index = 0; index < length; index += 1) {
    const sample = samples[index] ?? 0;
    const abs = Math.abs(sample);
    if (abs > peak) {
      peak = abs;
    }
    sum += sample * sample;
  }
  return {
    rmsDb: amplitudeToDb(Math.sqrt(sum / length)),
    peakDb: amplitudeToDb(peak),
  };
};

export const channelOwningSource = (channels: readonly AudioChannel[], sourceId: SourceId): AudioChannel | undefined =>
  channels.find((channel) => channel.sourceIds.includes(sourceId));

/** A global channel stays in the mix when the active scene has no layer for it. */
export const channelAudibleInScene = (
  channel: Pick<AudioChannel, 'id' | 'global'>,
  enabledChannelIds: ReadonlySet<string>,
): boolean => channel.global || enabledChannelIds.has(channel.id);
