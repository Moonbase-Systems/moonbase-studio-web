import type { AnimationMediaKind } from '../models/source.domain';

export type AnimationPlayerState = 'idle' | 'playing' | 'paused' | 'ended';

export type AnimationPlayerCapabilities = {
  pause: boolean;
  rate: boolean;
  seek: boolean;
  pingPong: boolean;
  loopCount: boolean;
  volume: boolean;
  ended: boolean;
  restart: boolean;
};

export type AnimationPlayer = {
  readonly kind: 'image' | 'video';
  readonly capabilities: AnimationPlayerCapabilities;
  readonly element: HTMLImageElement | HTMLVideoElement;
  play: () => void;
  pause: () => void;
  stop: () => void;
  restart: () => void;
  setRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  seek: (ms: number) => void;
  onEnded: (listener: () => void) => () => void;
  dispose: () => void;
  getState: () => AnimationPlayerState;
  hasAudio: () => boolean;
};

export const capabilitiesForMediaKind = (mediaKind: AnimationMediaKind): AnimationPlayerCapabilities => {
  if (mediaKind === 'video') {
    return {
      pause: true,
      rate: true,
      seek: true,
      pingPong: false,
      loopCount: true,
      volume: false,
      ended: true,
      restart: true,
    };
  }
  return {
    pause: false,
    rate: false,
    seek: false,
    pingPong: false,
    loopCount: false,
    volume: false,
    ended: false,
    restart: true,
  };
};
