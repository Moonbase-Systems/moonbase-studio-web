import type { SourceId } from '../ids.domain';
import type { SourceMetadata } from '../source.domain';

export type ScreenCaptureTarget = 'display' | 'window';

export type ScreenSourceSettings = {
  captureTarget?: ScreenCaptureTarget;
};

export type ScreenSource = {
  id: SourceId;
  name: string;
  type: 'screen';
  displayId?: string;
  settings?: ScreenSourceSettings;
  metadata?: SourceMetadata;
};
