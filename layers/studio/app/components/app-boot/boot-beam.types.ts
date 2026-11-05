import type { BootSwayPivotStage, BootSwaySample } from '../../composables/boot-sway-motion';

/** Mutable sway + light state shared by beam track and label paint (no Vue reactivity). */
export type BootBeamSwayMotionState = {
  pivot: BootSwayPivotStage | null;
  sample: BootSwaySample | null;
  lightPower: number;
  onFrame?: (originStage: { x: number; y: number }) => void;
};
