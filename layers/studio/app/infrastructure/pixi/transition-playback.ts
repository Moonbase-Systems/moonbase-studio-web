export type FadeCurve = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export type TransitionPlayer = 'cut' | 'fade' | 'missing';

/** Cut and fade run on the composition clock. Slide, zoom and dissolve have no player. */
export const transitionPlayer = (type: string): TransitionPlayer => {
  if (type === 'cut') {
    return 'cut';
  }
  if (type === 'fade') {
    return 'fade';
  }
  return 'missing';
};

/** Unit progress for a fade. A non-positive duration finishes immediately. */
export const fadeProgress = (elapsedMs: number, durationMs: number, curve: FadeCurve): number => {
  if (durationMs <= 0) {
    return 1;
  }
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  switch (curve) {
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    default:
      return t;
  }
};
