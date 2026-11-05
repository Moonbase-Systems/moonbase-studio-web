import { describe, expect, it } from 'vitest';

import { bootBeamPointsToAttr, computeBeamTrapezoid } from './boot-beam-geometry';

describe('computeBeamTrapezoid', () => {
  it('builds a trapezoid from origin to target', () => {
    const points = computeBeamTrapezoid({ x: 60, y: 40 }, { x: 60, y: 120 }, 8, 40);
    expect(points).toHaveLength(4);
    expect(bootBeamPointsToAttr(points).length).toBeGreaterThan(0);
  });

  it('returns empty when origin and target overlap', () => {
    expect(computeBeamTrapezoid({ x: 0, y: 0 }, { x: 0, y: 0 }, 8, 40)).toEqual([]);
  });
});
