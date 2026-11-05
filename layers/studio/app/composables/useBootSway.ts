import { bootTiming } from '../components/app-boot/boot-timing';

export function useBootSway(options: { active: Ref<boolean>; reduceMotion: Ref<boolean> }) {
  const enterComplete = ref(false);
  const swayFrozen = ref(false);
  const neutralGateOpen = ref(false);

  let neutralResolver: (() => void) | null = null;
  let neutralFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  const clearNeutralWait = (): void => {
    if (neutralFallbackTimer) {
      clearTimeout(neutralFallbackTimer);
      neutralFallbackTimer = null;
    }
    neutralResolver = null;
    neutralGateOpen.value = false;
  };

  const onEnterAnimationEnd = (): void => {
    enterComplete.value = true;
  };

  const onSwayNeutral = (): void => {
    if (!neutralGateOpen.value || !neutralResolver) {
      return;
    }

    swayFrozen.value = true;
    const resolve = neutralResolver;
    clearNeutralWait();
    resolve();
  };

  const waitForNeutral = (): Promise<void> => {
    if (options.reduceMotion.value) {
      swayFrozen.value = true;
      return Promise.resolve();
    }

    neutralGateOpen.value = true;
    swayFrozen.value = false;

    return new Promise((resolve) => {
      neutralResolver = resolve;
      neutralFallbackTimer = setTimeout(() => {
        if (neutralResolver) {
          swayFrozen.value = true;
          neutralResolver();
          clearNeutralWait();
        }
      }, bootTiming.neutralWaitFallbackMs);
    });
  };

  const freezeSway = (): void => {
    swayFrozen.value = true;
    clearNeutralWait();
  };

  watch(
    () => options.active.value,
    (isActive) => {
      if (!isActive) {
        freezeSway();
      }
    },
  );

  onUnmounted(() => {
    clearNeutralWait();
  });

  return {
    enterComplete,
    swayFrozen,
    neutralGateOpen,
    onEnterAnimationEnd,
    onSwayNeutral,
    waitForNeutral,
    freezeSway,
  };
}
