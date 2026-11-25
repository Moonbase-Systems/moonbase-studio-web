import { describe, expect, it } from 'vitest';

import { bootSwayMotion, sampleBootSway } from './boot-sway-motion';

const period = bootSwayMotion.periodMs;

describe('sampleBootSway', () => {
  it('starts from the resting hover pose', () => {
    const sample = sampleBootSway(0);
    expect(sample.tx).toBe(0);
    expect(sample.rot).toBe(0);
    expect(sample.ty).toBe(bootSwayMotion.hoverY);
  });

  it('grows the swing in instead of starting at full speed', () => {
    const early = sampleBootSway(period / 4 - bootSwayMotion.rampInMs * 0.9);
    const settled = sampleBootSway(period * 2 + period / 4);
    expect(Math.abs(early.tx)).toBeLessThan(Math.abs(settled.tx));
    expect(settled.tx).toBeCloseTo(bootSwayMotion.amplitudeX);
    expect(settled.rot).toBeCloseTo(bootSwayMotion.amplitudeRot);
  });

  it('lifts the craft smoothly through the middle of the swing', () => {
    const middle = period * 2 + period / 2;
    const step = 4;
    const before = sampleBootSway(middle - step).ty;
    const at = sampleBootSway(middle).ty;
    const after = sampleBootSway(middle + step).ty;
    // A kink would make the slope flip sharply; here the curve is flat at the middle.
    expect(Math.abs(before - at)).toBeLessThan(0.001);
    expect(Math.abs(after - at)).toBeLessThan(0.001);
    expect(sampleBootSway(middle).atNeutral).toBe(true);
  });
});
