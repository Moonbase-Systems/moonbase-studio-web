import type { AnimationId, AssetId } from './ids.domain';

export type SceneAnimationMediaKind = 'gif' | 'video';

export type SceneAnimationSettings = {
  loop?: boolean;
  playbackRate?: number;
  fit?: string;
};

/** v1: media asset (GIF/video), not keyframe/GSAP tweens. */
export type SceneAnimation = {
  id: AnimationId;
  assetId: AssetId;
  mediaKind: SceneAnimationMediaKind;
  durationMs?: number;
  settings: SceneAnimationSettings;
};
