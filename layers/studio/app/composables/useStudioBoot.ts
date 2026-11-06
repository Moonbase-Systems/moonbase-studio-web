import { type BootStepI18nKey, isStudioBootSatisfied, runStudioBoot } from '../application/studio-boot';
import { bootTiming } from '../components/app-boot/boot-timing';
import {
  STUDIO_BOOT_EXIT_PHASE_KEY,
  STUDIO_BOOT_REVEAL_KEY,
  type StudioBootExitPhase,
} from '../components/app-boot/studio-boot-chrome';
import { useStudioSessionStore } from '../store/studio-session.store';
import { useStudioCompositionEngine } from './useCompositionEngine';

export type StudioBootStepHooks = {
  beforeStepLabel?: () => void | Promise<void>;
  afterStepLabel?: () => void | Promise<void>;
  onBootComplete?: () => Promise<void>;
  beforeSpin?: () => void | Promise<void>;
};

export function useStudioBoot(hooks?: StudioBootStepHooks) {
  const store = useStudioSessionStore();
  const compositionEngine = useStudioCompositionEngine();

  async function initializeEngine(): Promise<{ ok: boolean }> {
    // Boot starts in AppBootScreen's onMounted; the preview host is a later sibling.
    await nextTick();
    const started = await compositionEngine.initialize();
    if (!started.ok) {
      return started;
    }
    const scene = store.activeScene;
    if (scene) {
      await compositionEngine.render(scene);
    }
    return started;
  }

  const exitPhase = useState<StudioBootExitPhase>(STUDIO_BOOT_EXIT_PHASE_KEY, () => 'none');
  const studioReveal = useState(STUDIO_BOOT_REVEAL_KEY, () => false);

  const stepKey = ref<BootStepI18nKey | null>(null);
  const stepRevision = ref(0);
  const failed = ref(false);
  const overlayMounted = ref(true);
  const exiting = ref(false);

  const showOverlay = computed(() => overlayMounted.value);

  async function start() {
    failed.value = false;
    exiting.value = false;
    exitPhase.value = 'none';

    if (
      isStudioBootSatisfied(
        () => store.isInitialized,
        () => store.project != null,
        () => compositionEngine.isReady.value,
      )
    ) {
      studioReveal.value = true;
      overlayMounted.value = false;
      return;
    }

    studioReveal.value = false;
    overlayMounted.value = true;

    const result = await runStudioBoot({
      isInitialized: () => store.isInitialized,
      hasProject: () => store.project != null,
      initialize: () => store.initialize(),
      createProject: (input) => store.createProject(input),
      isEngineReady: () => compositionEngine.isReady.value,
      initializeEngine,
      stepPauseMs: bootTiming.stepPauseMs,
      onStep: async (key) => {
        if (stepKey.value !== null) {
          await hooks?.beforeStepLabel?.();
        }

        stepKey.value = key;
        stepRevision.value += 1;

        await hooks?.afterStepLabel?.();
      },
    });

    if (!result.ok) {
      failed.value = true;
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, bootTiming.readyHoldMs));

    await hooks?.onBootComplete?.();

    exiting.value = true;
    exitPhase.value = 'labels';
    await new Promise((resolve) => setTimeout(resolve, bootTiming.exitLabelsMs));

    exitPhase.value = 'spin';
    await hooks?.beforeSpin?.();
    await new Promise((resolve) => setTimeout(resolve, bootTiming.exitSpinMs));

    exitPhase.value = 'curtain';
    studioReveal.value = true;
    await new Promise((resolve) => setTimeout(resolve, bootTiming.exitCurtainMs));

    overlayMounted.value = false;
    exitPhase.value = 'none';
    exiting.value = false;
  }

  return {
    stepKey,
    stepRevision,
    failed,
    exiting,
    exitPhase,
    showOverlay,
    start,
  };
}
