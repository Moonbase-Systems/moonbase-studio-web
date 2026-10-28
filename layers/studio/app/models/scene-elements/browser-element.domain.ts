import type { SourceId } from '../ids.domain';
import type { SceneElementBase } from './scene-element-base.domain';

export type BrowserElementSettings = Record<string, never>;

export type BrowserElement = SceneElementBase & {
  type: 'browser';
  sourceId: SourceId;
  settings: BrowserElementSettings;
};

export const createDefaultBrowserElementSettings = (): BrowserElementSettings => ({});
