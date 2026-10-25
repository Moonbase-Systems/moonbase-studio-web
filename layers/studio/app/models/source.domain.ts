import type { AssetId, SourceId } from './ids.domain';

export type SourceType = 'camera' | 'screen' | 'image' | 'video' | 'text' | 'shape' | 'audio' | 'browser' | 'animation';

export type AnimationMediaKind = 'gif' | 'video';

export type AnimationPlaybackTrigger = 'manual' | 'on-activate' | 'interval';

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

export type CameraSource = SourceBase & {
  type: 'camera';
  deviceId?: string;
  settings?: Record<string, unknown>;
};

export type ScreenSource = SourceBase & {
  type: 'screen';
  displayId?: string;
  settings?: Record<string, unknown>;
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
  assetId?: AssetId;
  startFrame: number;
  startOffsetMs: number;
  durationMs: number | null;
  trigger: AnimationPlaybackTrigger;
  intervalMs: number | null;
};

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
