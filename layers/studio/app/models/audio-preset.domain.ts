import {
  type AudioEffect,
  type AudioEffectTemplate,
  type AudioEffectType,
  defaultCompressorParameters,
  defaultEqBandParameters,
  defaultHighPassParameters,
  defaultLimiterParameters,
  defaultNoiseGateParameters,
} from './audio-effect.domain';

export const AUDIO_PRESET_FORMAT_VERSION = 1;

export type AudioEffectPreset = {
  id: string;
  formatVersion: typeof AUDIO_PRESET_FORMAT_VERSION;
  kind: 'effect';
  name: string;
  effect: AudioEffectTemplate;
};

export type AudioChannelPreset = {
  id: string;
  formatVersion: typeof AUDIO_PRESET_FORMAT_VERSION;
  kind: 'channel';
  name: string;
  trimDb: number;
  faderDb: number;
  pan: number;
  muted: boolean;
  effects: AudioEffectTemplate[];
};

export type AudioUserPreset = AudioEffectPreset | AudioChannelPreset;

export type SystemChannelPreset = AudioChannelPreset & {
  descriptionKey: string;
};

const highPass = (frequencyHz: number): AudioEffectTemplate => ({
  type: 'high-pass',
  name: 'High-pass',
  enabled: true,
  parameters: { ...defaultHighPassParameters(), frequencyHz },
});

const eq = (name: string, parameters: Partial<ReturnType<typeof defaultEqBandParameters>>): AudioEffectTemplate => ({
  type: 'eq-band',
  name,
  enabled: true,
  parameters: { ...defaultEqBandParameters(), ...parameters },
});

const compressor = (parameters: Partial<ReturnType<typeof defaultCompressorParameters>>): AudioEffectTemplate => ({
  type: 'compressor',
  name: 'Compressor',
  enabled: true,
  parameters: { ...defaultCompressorParameters(), ...parameters },
});

const gate = (parameters: Partial<ReturnType<typeof defaultNoiseGateParameters>>): AudioEffectTemplate => ({
  type: 'noise-gate',
  name: 'Gate',
  enabled: true,
  parameters: { ...defaultNoiseGateParameters(), ...parameters },
});

const limiter = (parameters: Partial<ReturnType<typeof defaultLimiterParameters>>): AudioEffectTemplate => ({
  type: 'limiter',
  name: 'Limiter',
  enabled: true,
  parameters: { ...defaultLimiterParameters(), ...parameters },
});

const channelPreset = (
  input: Omit<SystemChannelPreset, 'formatVersion' | 'kind' | 'trimDb' | 'faderDb' | 'pan' | 'muted'> &
    Partial<Pick<SystemChannelPreset, 'trimDb' | 'faderDb' | 'pan' | 'muted'>>,
): SystemChannelPreset => ({
  formatVersion: AUDIO_PRESET_FORMAT_VERSION,
  kind: 'channel',
  trimDb: input.trimDb ?? 0,
  faderDb: input.faderDb ?? 0,
  pan: input.pan ?? 0,
  muted: input.muted ?? false,
  id: input.id,
  name: input.name,
  descriptionKey: input.descriptionKey,
  effects: input.effects,
});

/**
 * Starting points, not a matched tone for every microphone.
 * They stay in code until someone applies one. Applying copies the values onto a channel.
 */
export const SYSTEM_CHANNEL_PRESETS: readonly SystemChannelPreset[] = [
  channelPreset({
    id: 'system:clean-voice',
    name: 'Clean Voice',
    descriptionKey: 'studio.audio.presets.cleanVoice',
    effects: [
      highPass(80),
      compressor({ thresholdDb: -16, ratio: 2, attackMs: 15, releaseMs: 120, makeupDb: 1, kneeDb: 10 }),
    ],
  }),
  channelPreset({
    id: 'system:warm-voice',
    name: 'Warm Voice',
    descriptionKey: 'studio.audio.presets.warmVoice',
    effects: [
      highPass(70),
      eq('Low shelf', { filter: 'lowshelf', frequencyHz: 200, gainDb: 2, q: 0.7 }),
      eq('Presence', { filter: 'peaking', frequencyHz: 3000, gainDb: 1.5, q: 1 }),
      compressor({ thresholdDb: -18, ratio: 2.5, attackMs: 12, releaseMs: 140, makeupDb: 1.5, kneeDb: 12 }),
    ],
  }),
  channelPreset({
    id: 'system:podcast-voice',
    name: 'Podcast Voice',
    descriptionKey: 'studio.audio.presets.podcastVoice',
    effects: [
      highPass(90),
      eq('Mud', { filter: 'peaking', frequencyHz: 250, gainDb: -2, q: 1 }),
      eq('Clarity', { filter: 'peaking', frequencyHz: 4000, gainDb: 2, q: 1.2 }),
      compressor({ thresholdDb: -20, ratio: 3, attackMs: 10, releaseMs: 150, makeupDb: 3, kneeDb: 8 }),
      gate({ thresholdDb: -42, rangeDb: -50, attackMs: 8, holdMs: 60, releaseMs: 120 }),
    ],
  }),
  channelPreset({
    id: 'system:streaming-voice',
    name: 'Streaming Voice',
    descriptionKey: 'studio.audio.presets.streamingVoice',
    effects: [
      highPass(100),
      eq('Low cut body', { filter: 'peaking', frequencyHz: 180, gainDb: -1.5, q: 1 }),
      eq('Presence', { filter: 'peaking', frequencyHz: 2500, gainDb: 1.5, q: 1 }),
      compressor({ thresholdDb: -16, ratio: 3.5, attackMs: 8, releaseMs: 100, makeupDb: 2, kneeDb: 10 }),
      limiter({ ceilingDb: -2, releaseMs: 60, lookaheadMs: 5 }),
    ],
  }),
  channelPreset({
    id: 'system:noise-reduction-light',
    name: 'Noise Reduction Light',
    descriptionKey: 'studio.audio.presets.noiseReductionLight',
    effects: [highPass(100), gate({ thresholdDb: -38, rangeDb: -24, attackMs: 10, holdMs: 40, releaseMs: 180 })],
  }),
  channelPreset({
    id: 'system:broadcast-compression',
    name: 'Broadcast Compression',
    descriptionKey: 'studio.audio.presets.broadcastCompression',
    effects: [
      highPass(80),
      compressor({ thresholdDb: -24, ratio: 4, attackMs: 5, releaseMs: 80, makeupDb: 4, kneeDb: 6 }),
      limiter({ ceilingDb: -1.5, releaseMs: 50, lookaheadMs: 5 }),
    ],
  }),
];

export const findSystemChannelPreset = (presetId: string): SystemChannelPreset | undefined =>
  SYSTEM_CHANNEL_PRESETS.find((preset) => preset.id === presetId);

export const presetRejection = (
  preset: { formatVersion: number; kind: string },
  expectedKind: 'effect' | 'channel',
): 'version' | 'kind' | null => {
  if (preset.formatVersion !== AUDIO_PRESET_FORMAT_VERSION) {
    return 'version';
  }
  if (preset.kind !== expectedKind) {
    return 'kind';
  }
  return null;
};

export const effectPresetType = (preset: AudioEffectPreset): AudioEffectType => preset.effect.type;

const parameterSignature = (parameters: object): string => {
  const record = parameters as Record<string, string | number | boolean>;
  return Object.keys(record)
    .sort()
    .map((key) => `${key}:${String(record[key])}`)
    .join('|');
};

/** Same type, name, bypass and parameters. Effect ids are assigned on apply, so they do not count. */
export const effectMatchesTemplate = (effect: AudioEffect, template: AudioEffectTemplate): boolean =>
  effect.type === template.type &&
  effect.name === template.name &&
  effect.enabled === template.enabled &&
  parameterSignature(effect.parameters) === parameterSignature(template.parameters);

export const channelMatchesPreset = (
  channel: {
    trimDb: number;
    faderDb: number;
    pan: number;
    muted: boolean;
    effects: readonly AudioEffect[];
  },
  preset: Pick<AudioChannelPreset, 'trimDb' | 'faderDb' | 'pan' | 'muted' | 'effects'>,
): boolean => {
  if (
    channel.trimDb !== preset.trimDb ||
    channel.faderDb !== preset.faderDb ||
    channel.pan !== preset.pan ||
    channel.muted !== preset.muted ||
    channel.effects.length !== preset.effects.length
  ) {
    return false;
  }
  return channel.effects.every((effect, index) => {
    const template = preset.effects[index];
    return template !== undefined && effectMatchesTemplate(effect, template);
  });
};
