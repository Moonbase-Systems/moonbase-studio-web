import { bootTiming } from '../components/app-boot/boot-timing';

export const bootSwayMotion = {
  periodMs: bootTiming.swayPendulumMs,
  hoverY: -10,
  amplitudeX: 12,
  amplitudeY: 2,
  amplitudeRot: 8,
  /** Pivot → beam anchor in px (transform-origin 50% 85%, anchor ~50% height). */
  anchorOffsetY: -18,
  neutralSinEpsilon: 0.07,
} as const;

export type BootSwaySample = {
  tx: number;
  ty: number;
  rot: number;
  sin: number;
  phase: number;
  atNeutral: boolean;
};

export function sampleBootSway(elapsedMs: number): BootSwaySample {
  const phase = (elapsedMs % bootSwayMotion.periodMs) / bootSwayMotion.periodMs;
  const sin = Math.sin(phase * Math.PI * 2);
  const tx = sin * bootSwayMotion.amplitudeX;
  const ty = bootSwayMotion.hoverY - Math.abs(sin) * bootSwayMotion.amplitudeY;
  const rot = sin * bootSwayMotion.amplitudeRot;

  return {
    tx,
    ty,
    rot,
    sin,
    phase,
    atNeutral: Math.abs(sin) < bootSwayMotion.neutralSinEpsilon,
  };
}

export function bootSwayTransform(sample: BootSwaySample): string {
  return `translate3d(${sample.tx}px, ${sample.ty}px, 0) rotate(${sample.rot}deg)`;
}

export type BootSwayPivotStage = {
  pivotX: number;
  pivotY: number;
};

/** Beam anchor in stage coordinates from a measured pivot (neutral pose). */
export function bootSwayBeamAnchorStage(pivot: BootSwayPivotStage, sample: BootSwaySample): { x: number; y: number } {
  const rad = (sample.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sinR = Math.sin(rad);
  const localY = bootSwayMotion.anchorOffsetY;
  const offsetX = localY * sinR;
  const offsetY = localY * cos;

  return {
    x: pivot.pivotX + sample.tx + offsetX,
    y: pivot.pivotY + sample.ty + offsetY,
  };
}
