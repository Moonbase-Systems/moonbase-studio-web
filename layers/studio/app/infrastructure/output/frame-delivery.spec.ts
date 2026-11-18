import { describe, expect, it } from 'vitest';

import { deliveredFramesPerSecond, emptyFrameDelivery } from './frame-delivery';

describe('deliveredFramesPerSecond', () => {
  it('stays empty until two frames have a span', () => {
    expect(deliveredFramesPerSecond(emptyFrameDelivery())).toBeNull();
  });

  it('counts intervals between copied frames', () => {
    const rate = deliveredFramesPerSecond({
      deliveredFrames: 31,
      firstDeliveredAt: 0,
      lastDeliveredAt: 1000,
      width: 1920,
      height: 1080,
    });
    expect(rate).toBe(30);
  });
});
