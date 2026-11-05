const swayHalfMs = 1_250;

export const bootTiming = {
  stepPauseMs: 600,
  readyHoldMs: 400,
  /** One half-swing (neutral → side → neutral). Full pendulum = 2×. */
  swayHalfMs,
  swayPendulumMs: swayHalfMs * 2,
  exitLabelsMs: 220,
  exitSpinMs: 920,
  exitCurtainMs: 780,
  lightOutMs: 140,
  lightGapMs: 60,
  lightHoldMs: 520,
  randomWaitMinMs: 2_800,
  randomWaitRangeMs: 4_200,
  neutralWaitFallbackMs: 4_000,
} as const;
