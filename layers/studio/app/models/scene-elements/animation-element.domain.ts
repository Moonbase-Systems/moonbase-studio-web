import type { SourceId } from '../ids.domain';
import type { SceneElementBase } from './scene-element-base.domain';

export type AnimationElementSettings = Record<string, never>;

export type AnimationElement = SceneElementBase & {
  type: 'animation';
  sourceId: SourceId;
  settings: AnimationElementSettings;
};

export const createDefaultAnimationElementSettings = (): AnimationElementSettings => ({});
