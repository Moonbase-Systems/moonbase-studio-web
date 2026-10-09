import type { TransitionId } from './ids.domain';

export type TransitionType = 'cut' | 'fade' | 'slide' | 'zoom' | (string & {});

export type Transition = {
  id: TransitionId;
  type: TransitionType;
  durationMs: number;
  easing: string;
  settings: Record<string, unknown>;
};
