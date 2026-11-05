import type { BootBeamSwayMotionState } from '../components/app-boot/boot-beam.types';
import {
  bootBeamPointsToAttr,
  centerOfRect,
  computeBeamTrapezoid,
  toStagePoint,
} from '../components/app-boot/boot-beam-geometry';
import { bootSwayBeamAnchorStage, sampleBootSway } from './boot-sway-motion';

export type { BootBeamSwayMotionState } from '../components/app-boot/boot-beam.types';

const SOURCE_HALF_WIDTH = 10;
const TARGET_HALF_WIDTH_MIN = 48;
const TARGET_HALF_WIDTH_MAX = 140;

export type BootBeamTrackElements = {
  stage: Ref<HTMLElement | null>;
  origin: Ref<HTMLElement | null>;
  label: Ref<HTMLElement | null>;
  polygon: Ref<SVGPolygonElement | null>;
  gradient: Ref<SVGLinearGradientElement | null>;
  ellipse: Ref<SVGEllipseElement | null>;
};

export function useBootBeamTrack(
  active: Ref<boolean>,
  elements: BootBeamTrackElements,
  swayMotion?: BootBeamSwayMotionState,
) {
  let frameId = 0;

  const scheduleFrame = (callback: FrameRequestCallback): number => {
    if (import.meta.client) {
      return requestAnimationFrame(callback);
    }
    return 0;
  };

  const cancelFrame = (id: number): void => {
    if (import.meta.client && id) {
      cancelAnimationFrame(id);
    }
  };

  const resolveOriginStage = (stageRect: DOMRect): { x: number; y: number } | null => {
    if (swayMotion) {
      if (!swayMotion.pivot) {
        return null;
      }

      const sample = swayMotion.sample ?? sampleBootSway(0);
      return bootSwayBeamAnchorStage(swayMotion.pivot, sample);
    }

    const originEl = elements.origin.value;
    if (!originEl) {
      return null;
    }

    return toStagePoint(centerOfRect(originEl.getBoundingClientRect()), stageRect);
  };

  const measure = (): void => {
    if (!import.meta.client) {
      return;
    }

    const stage = elements.stage.value;
    const labelEl = elements.label.value;
    const polygon = elements.polygon.value;
    const gradient = elements.gradient.value;
    const ellipse = elements.ellipse.value;

    if (!stage || !labelEl || !polygon || !gradient || !ellipse) {
      polygon?.setAttribute('points', '');
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const origin = resolveOriginStage(stageRect);
    if (!origin) {
      polygon.setAttribute('points', '');
      return;
    }

    swayMotion?.onFrame?.(origin);

    const labelRect = labelEl.getBoundingClientRect();
    const target = toStagePoint(centerOfRect(labelRect), stageRect);

    const targetHalfWidth = Math.min(TARGET_HALF_WIDTH_MAX, Math.max(TARGET_HALF_WIDTH_MIN, labelRect.width * 0.55));

    const trapezoid = computeBeamTrapezoid(origin, target, SOURCE_HALF_WIDTH, targetHalfWidth);
    if (trapezoid.length === 0) {
      polygon.setAttribute('points', '');
      return;
    }

    polygon.setAttribute('points', bootBeamPointsToAttr(trapezoid));
    gradient.setAttribute('x1', String(origin.x));
    gradient.setAttribute('y1', String(origin.y));
    gradient.setAttribute('x2', String(target.x));
    gradient.setAttribute('y2', String(target.y));

    ellipse.setAttribute('cx', String(target.x));
    ellipse.setAttribute('cy', String(target.y));
    ellipse.setAttribute('rx', String(targetHalfWidth * 0.85));
    ellipse.setAttribute('ry', '7');
  };

  const tick = (): void => {
    measure();
    if (active.value) {
      frameId = scheduleFrame(tick);
    }
  };

  watch(
    active,
    (isActive) => {
      cancelFrame(frameId);
      frameId = 0;
      if (isActive && import.meta.client) {
        frameId = scheduleFrame(tick);
      }
    },
    { immediate: true },
  );

  onMounted(() => {
    if (active.value && import.meta.client) {
      frameId = scheduleFrame(tick);
    }
  });

  onUnmounted(() => {
    cancelFrame(frameId);
  });

  watch(
    () => elements.label.value,
    () => {
      nextTick(() => measure());
    },
  );

  return { remeasure: measure };
}
