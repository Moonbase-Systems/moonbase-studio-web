import type { SourceId } from '../ids.domain';
import type { SourceMetadata } from '../source.domain';

export type CameraSourceSettings = {
  width?: number;
  height?: number;
  frameRate?: number;
  audioInputDeviceId?: string;
};

export type CameraSource = {
  id: SourceId;
  name: string;
  type: 'camera';
  deviceId?: string;
  settings?: CameraSourceSettings;
  metadata?: SourceMetadata;
};
