import { type BootSwaySample, bootSwayTransform, sampleBootSway } from './boot-sway-motion';

export function useBootCraftSwayMotion(options: {
  element: Ref<HTMLElement | null>;
  active: Ref<boolean>;
  paused: Ref<boolean>;
  reduceMotion: Ref<boolean>;
  onFrame?: (sample: BootSwaySample) => void;
  onNeutral?: () => void;
}) {
  let frameId = 0;
  let startTime = 0;
  let neutralNotified = false;

  const applySample = (sample: BootSwaySample): void => {
    const node = options.element.value;
    if (!node) {
      return;
    }
    node.style.transform = bootSwayTransform(sample);
    options.onFrame?.(sample);

    if (sample.atNeutral && !neutralNotified) {
      neutralNotified = true;
      options.onNeutral?.();
    } else if (!sample.atNeutral) {
      neutralNotified = false;
    }
  };

  const tick = (now: number): void => {
    if (!options.active.value || options.paused.value || options.reduceMotion.value) {
      frameId = 0;
      return;
    }

    if (!startTime) {
      startTime = now;
    }

    applySample(sampleBootSway(now - startTime));
    frameId = requestAnimationFrame(tick);
  };

  const stopLoop = (): void => {
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };

  const resetTiming = (): void => {
    startTime = 0;
    neutralNotified = false;
  };

  const snapNeutral = (): void => {
    stopLoop();
    const node = options.element.value;
    if (node) {
      node.style.transform = bootSwayTransform(sampleBootSway(0));
    }
  };

  watch(
    [options.active, options.paused, options.reduceMotion],
    ([active, paused, reduce]) => {
      stopLoop();
      resetTiming();

      if (!active || paused || reduce) {
        if (reduce || paused) {
          snapNeutral();
        }
        return;
      }

      if (import.meta.client) {
        frameId = requestAnimationFrame(tick);
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    stopLoop();
  });

  return {
    resetTiming,
    snapNeutral,
    stopLoop,
  };
}
