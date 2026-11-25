import { describe, expect, it } from 'vitest';

import { fadeProgress, transitionPlayer } from './transition-playback';

describe('transitionPlayer', () => {
  it('plays cut and fade and reports every other type as missing', () => {
    expect(transitionPlayer('cut')).toBe('cut');
    expect(transitionPlayer('fade')).toBe('fade');
    expect(transitionPlayer('slide')).toBe('missing');
    expect(transitionPlayer('zoom')).toBe('missing');
    expect(fadeProgress(500, 1000, 'linear')).toBe(0.5);
    expect(fadeProgress(0, 0, 'linear')).toBe(1);
  });
});
