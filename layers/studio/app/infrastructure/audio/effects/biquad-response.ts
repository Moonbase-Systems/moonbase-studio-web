import type { AudioEffect } from '../../../models/audio-effect.domain';

export const EQ_CURVE_POINTS = 48;

export const logFrequencies = (count = EQ_CURVE_POINTS, min = 20, max = 20_000): Float32Array<ArrayBuffer> => {
  const values = new Float32Array(count);
  const start = Math.log(min);
  const end = Math.log(max);
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0 : index / (count - 1);
    values[index] = Math.exp(start + (end - start) * t);
  }
  return values;
};

const ramp = (param: AudioParam, value: number, time?: number) => {
  if (time === undefined) {
    param.value = value;
    return;
  }
  param.setTargetAtTime(value, time, 0.015);
};

export const applyBiquad = (
  filter: BiquadFilterNode,
  effect: Extract<AudioEffect, { type: 'eq-band' | 'high-pass' }>,
  time?: number,
): void => {
  if (effect.type === 'high-pass') {
    filter.type = 'highpass';
    ramp(filter.frequency, effect.parameters.frequencyHz, time);
    ramp(filter.Q, effect.parameters.q, time);
    ramp(filter.gain, 0, time);
    return;
  }
  filter.type = effect.parameters.filter;
  ramp(filter.frequency, effect.parameters.frequencyHz, time);
  ramp(filter.Q, effect.parameters.q, time);
  ramp(filter.gain, effect.parameters.filter === 'notch' ? 0 : effect.parameters.gainDb, time);
};

export type FrequencyResponseNode = {
  getFrequencyResponse: (
    frequencyHz: Float32Array<ArrayBuffer>,
    magResponse: Float32Array<ArrayBuffer>,
    phaseResponse: Float32Array<ArrayBuffer>,
  ) => void;
};

/** Magnitude in dB from the node's own getFrequencyResponse. This is the curve, not a drawing. */
export const readMagnitudeDb = (
  filter: FrequencyResponseNode,
  frequencies: Float32Array<ArrayBuffer>,
): Float32Array<ArrayBuffer> => {
  const magnitude = new Float32Array(frequencies.length);
  const phase = new Float32Array(frequencies.length);
  filter.getFrequencyResponse(frequencies, magnitude, phase);
  const db = new Float32Array(frequencies.length);
  for (let index = 0; index < frequencies.length; index += 1) {
    db[index] = 20 * Math.log10(Math.max(magnitude[index] ?? 0, 1e-5));
  }
  return db;
};

export const curveFromEffect = (
  context: AudioContext,
  effect: Extract<AudioEffect, { type: 'eq-band' | 'high-pass' }>,
): { frequencies: number[]; magnitudeDb: number[] } => {
  const filter = context.createBiquadFilter();
  applyBiquad(filter, effect);
  const frequencies = logFrequencies();
  const magnitudeDb = readMagnitudeDb(filter, frequencies);
  filter.disconnect();
  return { frequencies: Array.from(frequencies), magnitudeDb: Array.from(magnitudeDb) };
};
