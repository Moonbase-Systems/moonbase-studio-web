import type { TransitionId } from './ids.domain';

type TransitionBase = {
  id: TransitionId;
  durationMs: number;
  easing: string;
};

export type CutTransitionSettings = Record<string, never>;

export type FadeTransitionSettings = {
  /** Optional fade curve hint for the renderer. */
  curve?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
};

export type DissolveTransitionSettings = {
  softEdge?: number;
};

export type SlideTransitionSettings = {
  direction: 'left' | 'right' | 'up' | 'down';
};

export type ZoomTransitionSettings = {
  scale: number;
};

export type CutTransition = TransitionBase & {
  type: 'cut';
  settings: CutTransitionSettings;
};

export type FadeTransition = TransitionBase & {
  type: 'fade';
  settings: FadeTransitionSettings;
};

export type DissolveTransition = TransitionBase & {
  type: 'dissolve';
  settings: DissolveTransitionSettings;
};

export type SlideTransition = TransitionBase & {
  type: 'slide';
  settings: SlideTransitionSettings;
};

export type ZoomTransition = TransitionBase & {
  type: 'zoom';
  settings: ZoomTransitionSettings;
};

export type Transition = CutTransition | FadeTransition | DissolveTransition | SlideTransition | ZoomTransition;

export type TransitionType = Transition['type'];
