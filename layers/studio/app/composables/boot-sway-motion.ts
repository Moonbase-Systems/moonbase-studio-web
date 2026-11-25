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
  /** The swing grows from rest over this time instead of starting at full speed. */
  rampInMs: 900,
} as const;

const smoothstep = (value: number): number => {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
};

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
  const ramp = smoothstep(elapsedMs / bootSwayMotion.rampInMs);
  const tx = sin * bootSwayMotion.amplitudeX * ramp;
  // sin² lifts the craft at both ends like |sin|, but without the kink as it crosses the middle.
  const ty = bootSwayMotion.hoverY - sin * sin * bootSwayMotion.amplitudeY * ramp;
  const rot = sin * bootSwayMotion.amplitudeRot * ramp;

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
