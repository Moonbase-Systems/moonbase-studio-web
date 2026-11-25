import { describe, expect, it, vi } from 'vitest';

import { logFrequencies, readMagnitudeDb } from './biquad-response';
import { readCompressorReduction } from './compressor-node';
import { limiterDelaySeconds, stepGate, stepLimiter } from './dynamics-envelope';

describe('biquad response', () => {
  it('asks the node for the frequency response and converts magnitude to dB', () => {
    const frequencies = logFrequencies(3);
    expect(frequencies[0]).toBeCloseTo(20);
    expect(frequencies[2]).toBeCloseTo(20_000);
    const getFrequencyResponse = vi.fn((hz: Float32Array, mag: Float32Array) => {
      expect(hz).toBe(frequencies);
      mag.fill(1);
    });
    const db = readMagnitudeDb({ getFrequencyResponse }, frequencies);
    expect(Array.from(db)).toEqual([0, 0, 0]);
  });
});

describe('dynamics envelope', () => {
  it('slews the gate toward the range instead of jumping to silence', () => {
    const params = { thresholdDb: -40, attackMs: 5, holdMs: 0, releaseMs: 150, rangeDb: -60 };
    let state = { envelope: 1, holdSamplesLeft: 0 };
    let gain = 1;
    for (let index = 0; index < 20; index += 1) {
      const step = stepGate(state, 0, params, 48_000);
      state = step.state;
      gain = step.gain;
    }
    expect(gain).toBeLessThan(1);
    expect(gain).toBeGreaterThan(10 ** (-60 / 20));
  });

  it('limits at once and releases toward unity', () => {
    const params = { ceilingDb: 0, releaseMs: 80 };
    const limited = stepLimiter({ gain: 1 }, 2, params, 48_000);
    expect(limited.gain).toBeCloseTo(0.5);
    const released = stepLimiter(limited.state, 0, params, 48_000);
    expect(released.gain).toBeGreaterThan(0.5);
    expect(released.gain).toBeLessThan(1);
    expect(limiterDelaySeconds(5)).toBeCloseTo(0.005);
  });
});

describe('compressor reduction', () => {
  it('returns the node reduction unchanged', () => {
    expect(readCompressorReduction({ reduction: -6.25 })).toBe(-6.25);
  });
});
