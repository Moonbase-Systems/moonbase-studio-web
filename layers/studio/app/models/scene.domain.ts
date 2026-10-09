import type { SceneAnimation } from './animation.domain';
import type { AssetId, SceneId, TransitionId } from './ids.domain';
import type { SceneElement } from './scene-element.domain';
import type { SceneGroup } from './scene-group.domain';

export type SceneBackground = { kind: 'none' } | { kind: 'color'; color: string } | { kind: 'image'; assetId: AssetId };

export type SceneSettings = {
  defaultTransitionId: TransitionId | null;
};

export type SceneMetadata = {
  notes?: string;
};

export type SceneAnimations = {
  onEnter: SceneAnimation | null;
  onExit: SceneAnimation | null;
};

export type Scene = {
  id: SceneId;
  name: string;
  settings: SceneSettings;
  background: SceneBackground;
  elements: SceneElement[];
  groups: SceneGroup[];
  animations: SceneAnimations;
  metadata?: SceneMetadata;
};
