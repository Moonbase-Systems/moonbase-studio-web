import { z } from 'zod';

import {
  type AudioEffectType,
  COMPRESSOR_ATTACK_MAX,
  COMPRESSOR_ATTACK_MIN,
  COMPRESSOR_KNEE_MAX,
  COMPRESSOR_KNEE_MIN,
  COMPRESSOR_MAKEUP_MAX,
  COMPRESSOR_MAKEUP_MIN,
  COMPRESSOR_RATIO_MAX,
  COMPRESSOR_RATIO_MIN,
  COMPRESSOR_RELEASE_MAX,
  COMPRESSOR_RELEASE_MIN,
  COMPRESSOR_THRESHOLD_MAX,
  COMPRESSOR_THRESHOLD_MIN,
  EQ_FILTERS,
  EQ_FREQUENCY_MAX,
  EQ_FREQUENCY_MIN,
  EQ_GAIN_MAX,
  EQ_GAIN_MIN,
  EQ_Q_MAX,
  EQ_Q_MIN,
  GATE_ATTACK_MAX,
  GATE_ATTACK_MIN,
  GATE_HOLD_MAX,
  GATE_HOLD_MIN,
  GATE_RANGE_MAX,
  GATE_RANGE_MIN,
  GATE_RELEASE_MAX,
  GATE_RELEASE_MIN,
  GATE_THRESHOLD_MAX,
  GATE_THRESHOLD_MIN,
  HPF_FREQUENCY_MAX,
  HPF_FREQUENCY_MIN,
  HPF_Q_MAX,
  HPF_Q_MIN,
  LIMITER_CEILING_MAX,
  LIMITER_CEILING_MIN,
  LIMITER_LOOKAHEAD_MAX,
  LIMITER_LOOKAHEAD_MIN,
  LIMITER_RELEASE_MAX,
  LIMITER_RELEASE_MIN,
} from '../models/audio-effect.domain';
import { AUDIO_PRESET_FORMAT_VERSION } from '../models/audio-preset.domain';

const finite = () => z.number().finite();

export const audioEffectNameSchema = z.string().trim().min(1).max(64);

const eqParametersSchema = z.strictObject({
  filter: z.enum(EQ_FILTERS),
  frequencyHz: finite().min(EQ_FREQUENCY_MIN).max(EQ_FREQUENCY_MAX),
  gainDb: finite().min(EQ_GAIN_MIN).max(EQ_GAIN_MAX),
  q: finite().min(EQ_Q_MIN).max(EQ_Q_MAX),
});

const highPassParametersSchema = z.strictObject({
  frequencyHz: finite().min(HPF_FREQUENCY_MIN).max(HPF_FREQUENCY_MAX),
  q: finite().min(HPF_Q_MIN).max(HPF_Q_MAX),
});

const compressorParametersSchema = z.strictObject({
  thresholdDb: finite().min(COMPRESSOR_THRESHOLD_MIN).max(COMPRESSOR_THRESHOLD_MAX),
  kneeDb: finite().min(COMPRESSOR_KNEE_MIN).max(COMPRESSOR_KNEE_MAX),
  ratio: finite().min(COMPRESSOR_RATIO_MIN).max(COMPRESSOR_RATIO_MAX),
  attackMs: finite().min(COMPRESSOR_ATTACK_MIN).max(COMPRESSOR_ATTACK_MAX),
  releaseMs: finite().min(COMPRESSOR_RELEASE_MIN).max(COMPRESSOR_RELEASE_MAX),
  makeupDb: finite().min(COMPRESSOR_MAKEUP_MIN).max(COMPRESSOR_MAKEUP_MAX),
});

const noiseGateParametersSchema = z.strictObject({
  thresholdDb: finite().min(GATE_THRESHOLD_MIN).max(GATE_THRESHOLD_MAX),
  attackMs: finite().min(GATE_ATTACK_MIN).max(GATE_ATTACK_MAX),
  holdMs: finite().min(GATE_HOLD_MIN).max(GATE_HOLD_MAX),
  releaseMs: finite().min(GATE_RELEASE_MIN).max(GATE_RELEASE_MAX),
  rangeDb: finite().min(GATE_RANGE_MIN).max(GATE_RANGE_MAX),
});

const limiterParametersSchema = z.strictObject({
  ceilingDb: finite().min(LIMITER_CEILING_MIN).max(LIMITER_CEILING_MAX),
  releaseMs: finite().min(LIMITER_RELEASE_MIN).max(LIMITER_RELEASE_MAX),
  lookaheadMs: finite().min(LIMITER_LOOKAHEAD_MIN).max(LIMITER_LOOKAHEAD_MAX),
});

const parameterSchemaByType = {
  'eq-band': eqParametersSchema,
  compressor: compressorParametersSchema,
  'noise-gate': noiseGateParametersSchema,
  limiter: limiterParametersSchema,
  'high-pass': highPassParametersSchema,
} as const;

export const parseAudioEffectParameters = (type: AudioEffectType, parameters: unknown) =>
  parameterSchemaByType[type].safeParse(parameters);

const effectIdentity = {
  name: audioEffectNameSchema,
  enabled: z.boolean(),
};

const eqEffectSchema = z.object({
  ...effectIdentity,
  type: z.literal('eq-band'),
  parameters: eqParametersSchema,
});

const compressorEffectSchema = z.object({
  ...effectIdentity,
  type: z.literal('compressor'),
  parameters: compressorParametersSchema,
});

const noiseGateEffectSchema = z.object({
  ...effectIdentity,
  type: z.literal('noise-gate'),
  parameters: noiseGateParametersSchema,
});

const limiterEffectSchema = z.object({
  ...effectIdentity,
  type: z.literal('limiter'),
  parameters: limiterParametersSchema,
});

const highPassEffectSchema = z.object({
  ...effectIdentity,
  type: z.literal('high-pass'),
  parameters: highPassParametersSchema,
});

export const audioEffectTemplateSchema = z.discriminatedUnion('type', [
  eqEffectSchema,
  compressorEffectSchema,
  noiseGateEffectSchema,
  limiterEffectSchema,
  highPassEffectSchema,
]);

export const audioEffectSchema = z.discriminatedUnion('type', [
  eqEffectSchema.extend({ id: z.string().min(1) }),
  compressorEffectSchema.extend({ id: z.string().min(1) }),
  noiseGateEffectSchema.extend({ id: z.string().min(1) }),
  limiterEffectSchema.extend({ id: z.string().min(1) }),
  highPassEffectSchema.extend({ id: z.string().min(1) }),
]);

const channelStripPresetFields = {
  trimDb: finite().min(-24).max(24),
  faderDb: finite().min(-60).max(12),
  pan: finite().min(-1).max(1),
  muted: z.boolean(),
  effects: z.array(audioEffectTemplateSchema),
};

export const audioUserPresetSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    formatVersion: z.literal(AUDIO_PRESET_FORMAT_VERSION),
    kind: z.literal('effect'),
    name: audioEffectNameSchema,
    effect: audioEffectTemplateSchema,
  }),
  z.object({
    id: z.string().min(1),
    formatVersion: z.literal(AUDIO_PRESET_FORMAT_VERSION),
    kind: z.literal('channel'),
    name: audioEffectNameSchema,
    ...channelStripPresetFields,
  }),
]);
