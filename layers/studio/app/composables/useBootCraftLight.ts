import { bootTiming } from '../components/app-boot/boot-timing';

const RESTING_LIGHT = 0.78;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export function useBootCraftLight(options: { active: Ref<boolean>; reduceMotion: Ref<boolean> }) {
  const lightPower = ref(0);
  const snappyLightTransition = ref(false);

  let randomTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRandomTimer = (): void => {
    if (randomTimer) {
      clearTimeout(randomTimer);
      randomTimer = null;
    }
  };

  const scheduleRandomBlink = (): void => {
    clearRandomTimer();
    if (!options.active.value || options.reduceMotion.value) {
      return;
    }

    const wait = bootTiming.randomWaitMinMs + Math.random() * bootTiming.randomWaitRangeMs;
    randomTimer = setTimeout(() => {
      void runRandomDoubleBlink();
    }, wait);
  };

  const runQuickDim = async (restore: number): Promise<void> => {
    snappyLightTransition.value = true;
    lightPower.value = 0.05;
    await delay(65 + Math.random() * 45);
    lightPower.value = restore;
    snappyLightTransition.value = false;
  };

  const runRandomDoubleBlink = async (): Promise<void> => {
    if (!options.active.value || options.reduceMotion.value) {
      return;
    }

    const restore = lightPower.value;
    await runQuickDim(restore);
    await delay(80);
    await runQuickDim(restore);
    scheduleRandomBlink();
  };

  const blinkOutBeforeStep = async (): Promise<void> => {
    if (options.reduceMotion.value) {
      lightPower.value = 0;
      return;
    }

    snappyLightTransition.value = true;
    lightPower.value = 0;
    await delay(bootTiming.lightOutMs);
    snappyLightTransition.value = false;
    await delay(bootTiming.lightGapMs);
  };

  const illuminateAfterStep = async (): Promise<void> => {
    if (options.reduceMotion.value) {
      lightPower.value = 1;
      return;
    }

    lightPower.value = 1;
    await delay(bootTiming.lightHoldMs);
    lightPower.value = RESTING_LIGHT;
    scheduleRandomBlink();
  };

  const signalBootComplete = async (): Promise<void> => {
    clearRandomTimer();
    if (options.reduceMotion.value) {
      return;
    }

    const restore = lightPower.value > 0 ? lightPower.value : RESTING_LIGHT;
    await runQuickDim(restore);
    await delay(90);
    await runQuickDim(restore);
  };

  const shutOffForSpin = async (): Promise<void> => {
    clearRandomTimer();
    lightPower.value = 0;
    await delay(120);
  };

  watch(
    () => options.active.value,
    (isActive) => {
      if (!isActive) {
        clearRandomTimer();
        lightPower.value = 0;
        return;
      }
      scheduleRandomBlink();
    },
    { immediate: true },
  );

  watch(options.reduceMotion, (reduce) => {
    if (reduce) {
      clearRandomTimer();
      if (lightPower.value > 0) {
        lightPower.value = 1;
      }
    } else if (options.active.value) {
      scheduleRandomBlink();
    }
  });

  onUnmounted(() => {
    clearRandomTimer();
  });

  return {
    lightPower,
    snappyLightTransition,
    blinkOutBeforeStep,
    illuminateAfterStep,
    signalBootComplete,
    shutOffForSpin,
  };
}
