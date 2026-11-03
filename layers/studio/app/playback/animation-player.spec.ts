import { describe, expect, it } from 'vitest';

import { capabilitiesForMediaKind } from './animation-player';

describe('animation player capabilities', () => {
  it('limits an image animation to showing and restarting', () => {
    expect(capabilitiesForMediaKind('gif')).toEqual({
      pause: false,
      rate: false,
      seek: false,
      pingPong: false,
      loopCount: false,
      volume: false,
      ended: false,
      restart: true,
    });
  });

  it('gives video forward transport without sound or reverse playback', () => {
    expect(capabilitiesForMediaKind('video')).toEqual({
      pause: true,
      rate: true,
      seek: true,
      pingPong: false,
      loopCount: true,
      volume: false,
      ended: true,
      restart: true,
    });
  });
});
