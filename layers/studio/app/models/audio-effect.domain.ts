import type { EffectId } from './ids.domain';

export const AUDIO_EFFECT_TYPES = ['eq-band', 'compressor', 'noise-gate', 'limiter', 'high-pass'] as const;

export type AudioEffectType = (typeof AUDIO_EFFECT_TYPES)[number];

export const EQ_FILTERS = ['peaking', 'lowshelf', 'highshelf', 'notch'] as const;

export type EqFilterKind = (typeof EQ_FILTERS)[number];

export const EQ_FREQUENCY_MIN = 20;
export const EQ_FREQUENCY_MAX = 20_000;
export const EQ_GAIN_MIN = -18;
export const EQ_GAIN_MAX = 18;
export const EQ_Q_MIN = 0.1;
export const EQ_Q_MAX = 18;

export const HPF_FREQUENCY_MIN = 20;
export const HPF_FREQUENCY_MAX = 20_000;
export const HPF_Q_MIN = 0.1;
export const HPF_Q_MAX = 10;

export const COMPRESSOR_THRESHOLD_MIN = -100;
export const COMPRESSOR_THRESHOLD_MAX = 0;
export const COMPRESSOR_KNEE_MIN = 0;
export const COMPRESSOR_KNEE_MAX = 40;
export const COMPRESSOR_RATIO_MIN = 1;
export const COMPRESSOR_RATIO_MAX = 20;
export const COMPRESSOR_ATTACK_MIN = 0;
export const COMPRESSOR_ATTACK_MAX = 1000;
export const COMPRESSOR_RELEASE_MIN = 0;
export const COMPRESSOR_RELEASE_MAX = 1000;
export const COMPRESSOR_MAKEUP_MIN = -12;
export const COMPRESSOR_MAKEUP_MAX = 24;

export const GATE_THRESHOLD_MIN = -80;
export const GATE_THRESHOLD_MAX = 0;
export const GATE_ATTACK_MIN = 0.1;
export const GATE_ATTACK_MAX = 200;
export const GATE_HOLD_MIN = 0;
export const GATE_HOLD_MAX = 2000;
export const GATE_RELEASE_MIN = 5;
export const GATE_RELEASE_MAX = 2000;
export const GATE_RANGE_MIN = -80;
export const GATE_RANGE_MAX = 0;

export const LIMITER_CEILING_MIN = -24;
export const LIMITER_CEILING_MAX = 0;
export const LIMITER_RELEASE_MIN = 5;
export const LIMITER_RELEASE_MAX = 500;
export const LIMITER_LOOKAHEAD_MIN = 1;
export const LIMITER_LOOKAHEAD_MAX = 20;
export const LIMITER_LOOKAHEAD_DEFAULT_MS = 5;

export type EqBandParameters = {
  filter: EqFilterKind;
  frequencyHz: number;
  gainDb: number;
  q: number;
};

export type HighPassParameters = {
  frequencyHz: number;
  q: number;
};

export type CompressorParameters = {
  thresholdDb: number;
  kneeDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  makeupDb: number;
};

export type NoiseGateParameters = {
  thresholdDb: number;
  attackMs: number;
  holdMs: number;
  releaseMs: number;
  rangeDb: number;
};

export type LimiterParameters = {
  ceilingDb: number;
  releaseMs: number;
  lookaheadMs: number;
};

type EffectBase = {
  id: EffectId;
  name: string;
  enabled: boolean;
};

export type AudioEffect =
  | (EffectBase & { type: 'eq-band'; parameters: EqBandParameters })
  | (EffectBase & { type: 'compressor'; parameters: CompressorParameters })
  | (EffectBase & { type: 'noise-gate'; parameters: NoiseGateParameters })
  | (EffectBase & { type: 'limiter'; parameters: LimiterParameters })
  | (EffectBase & { type: 'high-pass'; parameters: HighPassParameters });

export type AudioEffectTemplate =
  | { type: 'eq-band'; name: string; enabled: boolean; parameters: EqBandParameters }
  | { type: 'compressor'; name: string; enabled: boolean; parameters: CompressorParameters }
  | { type: 'noise-gate'; name: string; enabled: boolean; parameters: NoiseGateParameters }
  | { type: 'limiter'; name: string; enabled: boolean; parameters: LimiterParameters }
  | { type: 'high-pass'; name: string; enabled: boolean; parameters: HighPassParameters };

export const isAudioEffectType = (value: string): value is AudioEffectType =>
  (AUDIO_EFFECT_TYPES as readonly string[]).includes(value);

export const defaultEqBandParameters = (): EqBandParameters => ({
  filter: 'peaking',
  frequencyHz: 1000,
  gainDb: 0,
  q: 1,
});

export const defaultHighPassParameters = (): HighPassParameters => ({
  frequencyHz: 80,
  q: 0.707,
});

export const defaultCompressorParameters = (): CompressorParameters => ({
  thresholdDb: -18,
  kneeDb: 12,
  ratio: 3,
  attackMs: 10,
  releaseMs: 120,
  makeupDb: 0,
});

export const defaultNoiseGateParameters = (): NoiseGateParameters => ({
  thresholdDb: -40,
  attackMs: 5,
  holdMs: 80,
  releaseMs: 150,
  rangeDb: -60,
});

export const defaultLimiterParameters = (): LimiterParameters => ({
  ceilingDb: -1,
  releaseMs: 80,
  lookaheadMs: LIMITER_LOOKAHEAD_DEFAULT_MS,
});

export const defaultEffectName = (type: AudioEffectType): string => {
  switch (type) {
    case 'eq-band':
      return 'EQ';
    case 'compressor':
      return 'Compressor';
    case 'noise-gate':
      return 'Gate';
    case 'limiter':
      return 'Limiter';
    case 'high-pass':
      return 'High-pass';
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
};

export function createAudioEffect(input: {
  id: EffectId;
  type: 'eq-band';
  name?: string;
}): Extract<AudioEffect, { type: 'eq-band' }>;
export function createAudioEffect(input: {
  id: EffectId;
  type: 'compressor';
  name?: string;
}): Extract<AudioEffect, { type: 'compressor' }>;
export function createAudioEffect(input: {
  id: EffectId;
  type: 'noise-gate';
  name?: string;
}): Extract<AudioEffect, { type: 'noise-gate' }>;
export function createAudioEffect(input: {
  id: EffectId;
  type: 'limiter';
  name?: string;
}): Extract<AudioEffect, { type: 'limiter' }>;
export function createAudioEffect(input: {
  id: EffectId;
  type: 'high-pass';
  name?: string;
}): Extract<AudioEffect, { type: 'high-pass' }>;
export function createAudioEffect(input: { id: EffectId; type: AudioEffectType; name?: string }): AudioEffect;
export function createAudioEffect(input: { id: EffectId; type: AudioEffectType; name?: string }): AudioEffect {
  const name = input.name?.trim() || defaultEffectName(input.type);
  switch (input.type) {
    case 'eq-band':
      return { id: input.id, type: 'eq-band', name, enabled: true, parameters: defaultEqBandParameters() };
    case 'compressor':
      return { id: input.id, type: 'compressor', name, enabled: true, parameters: defaultCompressorParameters() };
    case 'noise-gate':
      return { id: input.id, type: 'noise-gate', name, enabled: true, parameters: defaultNoiseGateParameters() };
    case 'limiter':
      return { id: input.id, type: 'limiter', name, enabled: true, parameters: defaultLimiterParameters() };
    case 'high-pass':
      return { id: input.id, type: 'high-pass', name, enabled: true, parameters: defaultHighPassParameters() };
    default: {
      const unreachable: never = input.type;
      return unreachable;
    }
  }
}

/** Enabled effects, in chain order. A disabled effect is a bypass and leaves the signal path. */
export const effectsInSignalPath = (effects: readonly AudioEffect[]): AudioEffect[] =>
  effects.filter((effect) => effect.enabled);

export const effectPathSignature = (effects: readonly AudioEffect[]): string =>
  effectsInSignalPath(effects)
    .map((effect) => `${effect.id}:${effect.type}`)
    .join('>');

export const moveAudioEffect = (
  effects: readonly AudioEffect[],
  effectId: EffectId,
  toIndex: number,
): AudioEffect[] | null => {
  const from = effects.findIndex((effect) => effect.id === effectId);
  if (from < 0 || !Number.isInteger(toIndex) || toIndex < 0 || toIndex >= effects.length) {
    return null;
  }
  if (from === toIndex) {
    return [...effects];
  }
  const next = [...effects];
  const [item] = next.splice(from, 1);
  if (!item) {
    return null;
  }
  next.splice(toIndex, 0, item);
  return next;
};

export const resetAudioEffect = (effect: AudioEffect): AudioEffect => {
  switch (effect.type) {
    case 'eq-band':
      return { ...effect, parameters: defaultEqBandParameters() };
    case 'compressor':
      return { ...effect, parameters: defaultCompressorParameters() };
    case 'noise-gate':
      return { ...effect, parameters: defaultNoiseGateParameters() };
    case 'limiter':
      return { ...effect, parameters: defaultLimiterParameters() };
    case 'high-pass':
      return { ...effect, parameters: defaultHighPassParameters() };
    default: {
      const unreachable: never = effect;
      return unreachable;
    }
  }
};

export const duplicateAudioEffect = (effect: AudioEffect, id: EffectId): AudioEffect => {
  const copy = structuredClone(effect);
  copy.id = id;
  return copy;
};

export const effectTemplateFrom = (effect: AudioEffect): AudioEffectTemplate => {
  switch (effect.type) {
    case 'eq-band':
      return {
        type: 'eq-band',
        name: effect.name,
        enabled: effect.enabled,
        parameters: structuredClone(effect.parameters),
      };
    case 'compressor':
      return {
        type: 'compressor',
        name: effect.name,
        enabled: effect.enabled,
        parameters: structuredClone(effect.parameters),
      };
    case 'noise-gate':
      return {
        type: 'noise-gate',
        name: effect.name,
        enabled: effect.enabled,
        parameters: structuredClone(effect.parameters),
      };
    case 'limiter':
      return {
        type: 'limiter',
        name: effect.name,
        enabled: effect.enabled,
        parameters: structuredClone(effect.parameters),
      };
    case 'high-pass':
      return {
        type: 'high-pass',
        name: effect.name,
        enabled: effect.enabled,
        parameters: structuredClone(effect.parameters),
      };
    default: {
      const unreachable: never = effect;
      return unreachable;
    }
  }
};

export const instantiateEffectTemplate = (template: AudioEffectTemplate, id: EffectId): AudioEffect => {
  switch (template.type) {
    case 'eq-band':
      return {
        id,
        type: 'eq-band',
        name: template.name,
        enabled: template.enabled,
        parameters: structuredClone(template.parameters),
      };
    case 'compressor':
      return {
        id,
        type: 'compressor',
        name: template.name,
        enabled: template.enabled,
        parameters: structuredClone(template.parameters),
      };
    case 'noise-gate':
      return {
        id,
        type: 'noise-gate',
        name: template.name,
        enabled: template.enabled,
        parameters: structuredClone(template.parameters),
      };
    case 'limiter':
      return {
        id,
        type: 'limiter',
        name: template.name,
        enabled: template.enabled,
        parameters: structuredClone(template.parameters),
      };
    case 'high-pass':
      return {
        id,
        type: 'high-pass',
        name: template.name,
        enabled: template.enabled,
        parameters: structuredClone(template.parameters),
      };
    default: {
      const unreachable: never = template;
      return unreachable;
    }
  }
};

/** Lookahead latency stays inside the limiter insert. Other effects add none. */
export const effectLatencyMs = (effect: AudioEffect): number =>
  effect.type === 'limiter' ? effect.parameters.lookaheadMs : 0;

export const chainLatencyMs = (effects: readonly AudioEffect[]): number =>
  effectsInSignalPath(effects).reduce((sum, effect) => sum + effectLatencyMs(effect), 0);
