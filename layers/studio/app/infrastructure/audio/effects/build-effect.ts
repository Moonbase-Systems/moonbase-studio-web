import type { AudioEffect } from '../../../models/audio-effect.domain';
import { applyBiquad } from './biquad-response';
import { applyCompressor, readCompressorReduction } from './compressor-node';
import { limiterDelaySeconds } from './dynamics-envelope';
import type { BuiltEffect } from './effect-insert';

export const NOISE_GATE_WORKLET_URL = '/audio-worklets/noise-gate-processor.js';
export const LIMITER_WORKLET_URL = '/audio-worklets/limiter-processor.js';
export const NOISE_GATE_PROCESSOR = 'moonbase-noise-gate';
export const LIMITER_PROCESSOR = 'moonbase-limiter-gain';

const loadedWorklets = new WeakMap<BaseAudioContext, Set<string>>();

export const loadWorklet = async (context: BaseAudioContext, url: string): Promise<void> => {
  if (!context.audioWorklet) {
    throw new Error('AudioWorklet is unavailable');
  }
  const existing = loadedWorklets.get(context) ?? new Set<string>();
  if (existing.has(url)) {
    loadedWorklets.set(context, existing);
    return;
  }
  await context.audioWorklet.addModule(url);
  existing.add(url);
  loadedWorklets.set(context, existing);
};

const setParam = (node: AudioWorkletNode, name: string, value: number, time: number) => {
  const param = node.parameters.get(name);
  if (!param) {
    return;
  }
  param.setTargetAtTime(value, time, 0.015);
};

const buildBiquad = (
  context: AudioContext,
  effect: Extract<AudioEffect, { type: 'eq-band' | 'high-pass' }>,
): BuiltEffect => {
  const filter = context.createBiquadFilter();
  applyBiquad(filter, effect);
  return {
    id: effect.id,
    input: filter,
    output: filter,
    latencyMs: 0,
    update: (next) => {
      if (next.type === effect.type) {
        applyBiquad(filter, next, context.currentTime);
      }
    },
    reductionDb: () => null,
    dispose: () => {
      filter.disconnect();
    },
  };
};

const buildCompressor = (context: AudioContext, effect: Extract<AudioEffect, { type: 'compressor' }>): BuiltEffect => {
  const compressor = context.createDynamicsCompressor();
  const makeup = context.createGain();
  compressor.connect(makeup);
  applyCompressor(compressor, makeup, effect.parameters);
  return {
    id: effect.id,
    input: compressor,
    output: makeup,
    latencyMs: 0,
    update: (next) => {
      if (next.type === 'compressor') {
        applyCompressor(compressor, makeup, next.parameters, context.currentTime);
      }
    },
    reductionDb: () => readCompressorReduction(compressor),
    dispose: () => {
      compressor.disconnect();
      makeup.disconnect();
    },
  };
};

const buildGate = async (
  context: AudioContext,
  effect: Extract<AudioEffect, { type: 'noise-gate' }>,
): Promise<BuiltEffect> => {
  await loadWorklet(context, NOISE_GATE_WORKLET_URL);
  const node = new AudioWorkletNode(context, NOISE_GATE_PROCESSOR);
  const apply = (parameters: typeof effect.parameters) => {
    const time = context.currentTime;
    setParam(node, 'threshold', parameters.thresholdDb, time);
    setParam(node, 'attack', parameters.attackMs / 1000, time);
    setParam(node, 'hold', parameters.holdMs / 1000, time);
    setParam(node, 'release', parameters.releaseMs / 1000, time);
    setParam(node, 'range', parameters.rangeDb, time);
  };
  apply(effect.parameters);
  return {
    id: effect.id,
    input: node,
    output: node,
    latencyMs: 0,
    update: (next) => {
      if (next.type === 'noise-gate') {
        apply(next.parameters);
      }
    },
    reductionDb: () => null,
    dispose: () => {
      node.disconnect();
    },
  };
};

const buildLimiter = async (
  context: AudioContext,
  effect: Extract<AudioEffect, { type: 'limiter' }>,
): Promise<BuiltEffect> => {
  await loadWorklet(context, LIMITER_WORKLET_URL);
  const input = context.createGain();
  const delay = context.createDelay(0.05);
  const vca = context.createGain();
  const detector = new AudioWorkletNode(context, LIMITER_PROCESSOR);
  const apply = (parameters: typeof effect.parameters) => {
    delay.delayTime.setTargetAtTime(limiterDelaySeconds(parameters.lookaheadMs), context.currentTime, 0.015);
    setParam(detector, 'ceiling', parameters.ceilingDb, context.currentTime);
    setParam(detector, 'release', parameters.releaseMs / 1000, context.currentTime);
  };
  apply(effect.parameters);
  input.connect(delay);
  delay.connect(vca);
  input.connect(detector);
  detector.connect(vca.gain);
  const latency = { ms: effect.parameters.lookaheadMs };
  return {
    id: effect.id,
    input,
    output: vca,
    get latencyMs() {
      return latency.ms;
    },
    update: (next) => {
      if (next.type !== 'limiter') {
        return;
      }
      apply(next.parameters);
      latency.ms = next.parameters.lookaheadMs;
    },
    reductionDb: () => null,
    dispose: () => {
      input.disconnect();
      delay.disconnect();
      detector.disconnect();
      vca.disconnect();
    },
  };
};

export const buildEffect = async (context: AudioContext, effect: AudioEffect): Promise<BuiltEffect> => {
  switch (effect.type) {
    case 'eq-band':
    case 'high-pass':
      return buildBiquad(context, effect);
    case 'compressor':
      return buildCompressor(context, effect);
    case 'noise-gate':
      return buildGate(context, effect);
    case 'limiter':
      return buildLimiter(context, effect);
    default: {
      const unreachable: never = effect;
      return unreachable;
    }
  }
};
