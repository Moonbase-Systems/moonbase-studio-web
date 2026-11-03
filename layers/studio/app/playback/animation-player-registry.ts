import type { AnimationMediaKind } from '../models/source.domain';
import type { AnimationPlayer } from './animation-player';
import { createImageAnimationPlayer } from './image-animation-player';
import { createVideoPlayer } from './video-animation-player';

const players = new Map<string, AnimationPlayer>();

export type AnimationControls = {
  play: () => void;
  pause: () => void;
  stop: () => void;
  restart: () => void;
};

const controls = new Map<string, AnimationControls>();

export function holdAnimationControls(elementId: string, next: AnimationControls) {
  controls.set(elementId, next);
}

export function peekAnimationControls(elementId: string) {
  return controls.get(elementId);
}

export function releaseAnimationControls(elementId: string) {
  controls.delete(elementId);
}

export function holdAnimationPlayer(elementId: string, player: AnimationPlayer) {
  const previous = players.get(elementId);
  if (previous && previous !== player) {
    previous.dispose();
  }
  players.set(elementId, player);
}

export function peekAnimationPlayer(elementId: string) {
  return players.get(elementId);
}

export function releaseAnimationPlayer(elementId: string) {
  const player = players.get(elementId);
  if (!player) {
    return;
  }
  player.dispose();
  players.delete(elementId);
}

export function createAnimationPlayer(mediaKind: AnimationMediaKind, url: string): AnimationPlayer {
  if (mediaKind === 'video') {
    return createVideoPlayer(url);
  }
  return createImageAnimationPlayer(url);
}
