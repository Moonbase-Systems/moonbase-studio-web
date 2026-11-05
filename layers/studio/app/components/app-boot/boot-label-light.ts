import { bootSwayBeamAnchorStage, sampleBootSway } from '../../composables/boot-sway-motion';
import type { BootBeamSwayMotionState } from './boot-beam.types';

export type BootLabelLightPaint = {
  lightPower: number;
  lightLocalXPercent: number;
  lightLocalYPercent: number;
  lightAngleDeg: number;
};

export function resolveBeamOriginStage(sway: BootBeamSwayMotionState): { x: number; y: number } | null {
  if (!sway.pivot) {
    return null;
  }

  return bootSwayBeamAnchorStage(sway.pivot, sway.sample ?? sampleBootSway(0));
}

export function computeBootLabelLightPaint(
  labelEl: HTMLElement,
  stageEl: HTMLElement,
  lightStage: { x: number; y: number },
  lightPower: number,
): BootLabelLightPaint {
  const labelRect = labelEl.getBoundingClientRect();
  const stageRect = stageEl.getBoundingClientRect();

  const labelLeftStage = labelRect.left - stageRect.left;
  const labelTopStage = labelRect.top - stageRect.top;

  const lightLocalX = lightStage.x - labelLeftStage;
  const lightLocalY = lightStage.y - labelTopStage;

  const width = Math.max(labelRect.width, 1);
  const height = Math.max(labelRect.height, 1);

  const dx = lightLocalX - width * 0.5;
  const dy = lightLocalY - height * 0.5;

  return {
    lightPower,
    lightLocalXPercent: (lightLocalX / width) * 100,
    lightLocalYPercent: (lightLocalY / height) * 100,
    lightAngleDeg: (Math.atan2(dx, -dy) * 180) / Math.PI,
  };
}

export function applyBootLabelLightPaint(labelRoot: HTMLElement | null, paint: BootLabelLightPaint | null): void {
  if (!labelRoot) {
    return;
  }

  const target = labelRoot.classList.contains('boot-label-text')
    ? labelRoot
    : labelRoot.querySelector<HTMLElement>('.boot-label-text');

  if (!target) {
    return;
  }

  if (!paint) {
    target.style.removeProperty('--boot-light');
    target.style.removeProperty('--boot-light-x');
    target.style.removeProperty('--boot-light-y');
    target.style.removeProperty('--boot-light-angle');
    return;
  }

  target.style.setProperty('--boot-light', String(paint.lightPower));
  target.style.setProperty('--boot-light-x', `${paint.lightLocalXPercent}%`);
  target.style.setProperty('--boot-light-y', `${paint.lightLocalYPercent}%`);
  target.style.setProperty('--boot-light-angle', `${paint.lightAngleDeg}deg`);
}

export function syncBootLabelLightFromStage(
  labelRoot: HTMLElement | null,
  stageEl: HTMLElement | null,
  sway: BootBeamSwayMotionState,
  lightPower: number,
): void {
  if (!labelRoot || !stageEl) {
    applyBootLabelLightPaint(labelRoot, null);
    return;
  }

  const origin = resolveBeamOriginStage(sway);
  if (!origin) {
    applyBootLabelLightPaint(labelRoot, null);
    return;
  }

  applyBootLabelLightPaint(labelRoot, computeBootLabelLightPaint(labelRoot, stageEl, origin, lightPower));
}
