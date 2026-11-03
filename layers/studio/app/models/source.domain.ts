import type { AssetId, SourceId } from './ids.domain';
import type { CameraSource } from './sources/camera-source.domain';
import type { ScreenSource } from './sources/screen-source.domain';

export type { CameraSource, CameraSourceSettings } from './sources/camera-source.domain';
export type { ScreenCaptureTarget, ScreenSource, ScreenSourceSettings } from './sources/screen-source.domain';

export type SourceType = 'camera' | 'screen' | 'image' | 'video' | 'text' | 'shape' | 'audio' | 'browser' | 'animation';

export type AnimationMediaKind = 'gif' | 'video';

export type AnimationFormat = 'gif' | 'webp' | 'apng' | 'webm' | 'mp4';

export type AnimationPlaybackMode = 'once' | 'loop';

export type AnimationEndBehavior = 'hold' | 'reset' | 'hide' | 'stop';

export type AnimationPlaybackTrigger =
  | 'manual'
  | 'on-activate'
  | 'on-scene-start'
  | 'on-appear'
  | 'on-click'
  | 'after-delay'
  | 'interval';

export type SourceMetadata = {
  notes?: string;
};

type SourceBase = {
  id: SourceId;
  name: string;
  metadata?: SourceMetadata;
};

export type BrowserRefreshSettings = {
  intervalMs: number | null;
  refreshOnActivate: boolean;
  bypassCache: boolean;
};

export type BrowserSource = SourceBase & {
  type: 'browser';
  url: string;
  width: number;
  height: number;
  refreshSettings: BrowserRefreshSettings;
};

export type ImageSource = SourceBase & {
  type: 'image';
  assetId: AssetId;
};

export type VideoSource = SourceBase & {
  type: 'video';
  assetId: AssetId;
  loop?: boolean;
};

export type TextSource = SourceBase & {
  type: 'text';
  content: string;
  typography?: Record<string, unknown>;
};

export type ShapeSource = SourceBase & {
  type: 'shape';
  shapeKind: string;
  fill?: string;
  stroke?: string;
};

export type AudioSource = SourceBase & {
  type: 'audio';
  assetId?: AssetId;
  deviceId?: string;
};

/** Scene-layer media playback (GIF/video), not scene enter/exit animations. */
export type AnimationSource = SourceBase & {
  type: 'animation';
  mediaKind: AnimationMediaKind;
  format: AnimationFormat;
  assetId?: AssetId;
  startFrame: number;
  startOffsetMs: number;
  startPositionMs: number;
  durationMs: number | null;
  trigger: AnimationPlaybackTrigger;
  intervalMs: number | null;
  playbackMode: AnimationPlaybackMode;
  repeatCount: number | null;
  playbackRate: number;
  pauseOnHide: boolean;
  resetOnSceneStart: boolean;
  endBehavior: AnimationEndBehavior;
  volume: number;
};

export const defaultAnimationFormat = (mediaKind: AnimationMediaKind): AnimationFormat =>
  mediaKind === 'video' ? 'mp4' : 'gif';

export const createDefaultAnimationSourceFields = (
  mediaKind: AnimationMediaKind = 'gif',
): Omit<AnimationSource, 'id' | 'name' | 'type' | 'metadata'> => ({
  mediaKind,
  format: defaultAnimationFormat(mediaKind),
  startFrame: 0,
  startOffsetMs: 0,
  startPositionMs: 0,
  durationMs: null,
  trigger: 'manual',
  intervalMs: null,
  playbackMode: 'once',
  repeatCount: 1,
  playbackRate: 1,
  pauseOnHide: true,
  resetOnSceneStart: false,
  endBehavior: 'hold',
  volume: 1,
});

export type Source =
  | BrowserSource
  | CameraSource
  | ScreenSource
  | ImageSource
  | VideoSource
  | TextSource
  | ShapeSource
  | AudioSource
  | AnimationSource;
