<script setup lang="ts">
import './boot-label-glass.css';

import { STUDIO_ENTRY_COVER_KEY } from '~/constants/studio-entry-cover';

import { type BootSwaySample, sampleBootSway } from '../../composables/boot-sway-motion';
import { useBootCraftLight } from '../../composables/useBootCraftLight';
import { useBootSway } from '../../composables/useBootSway';
import { useStudioBoot } from '../../composables/useStudioBoot';
import AppBootBeamLayer from './AppBootBeamLayer.vue';
import type { BootBeamSwayMotionState } from './boot-beam.types';
import { bootBeamAnchorTopPercent } from './boot-craft-anchor';
import { syncBootLabelLightFromStage } from './boot-label-light';
import BootCraftRig from './BootCraftRig.vue';

const studioEntryCover = useState(STUDIO_ENTRY_COVER_KEY, () => false);
studioEntryCover.value = false;

const prefersReducedMotion = usePreferredReducedMotion();
const reduceMotion = computed(() => prefersReducedMotion.value === 'reduce');

const bootLightActive = ref(true);
const swayLoopActive = ref(true);

const { enterComplete, swayFrozen, neutralGateOpen, onEnterAnimationEnd, onSwayNeutral, waitForNeutral, freezeSway } =
  useBootSway({
    active: swayLoopActive,
    reduceMotion,
  });

const {
  lightPower,
  snappyLightTransition,
  blinkOutBeforeStep,
  illuminateAfterStep,
  signalBootComplete,
  shutOffForSpin,
} = useBootCraftLight({
  active: bootLightActive,
  reduceMotion,
});

const { stepKey, stepRevision, failed, exitPhase, showOverlay, start } = useStudioBoot({
  beforeStepLabel: blinkOutBeforeStep,
  afterStepLabel: illuminateAfterStep,
  onBootComplete: async () => {
    await signalBootComplete();
    await waitForNeutral();
    freezeSway();
  },
  beforeSpin: shutOffForSpin,
});

const beamCraftReady = ref(false);

watch(
  [showOverlay, exitPhase, failed, enterComplete],
  () => {
    swayLoopActive.value = showOverlay.value && exitPhase.value === 'none' && !failed.value;
    bootLightActive.value =
      showOverlay.value && enterComplete.value && exitPhase.value !== 'spin' && exitPhase.value !== 'curtain';
  },
  { immediate: true },
);

const craftSwayActive = computed(
  () => showOverlay.value && !failed.value && exitPhase.value === 'none' && enterComplete.value,
);

const stageRef = ref<HTMLElement | null>(null);
const craftRigRef = ref<InstanceType<typeof BootCraftRig> | null>(null);
const beamOriginRef = ref<HTMLElement | null>(null);
const labelTargetRef = ref<HTMLElement | null>(null);

const repaintLabelLight = (): void => {
  syncBootLabelLightFromStage(labelTargetRef.value, stageRef.value, swayBeamMotion, swayBeamMotion.lightPower);
};

const swayBeamMotion: BootBeamSwayMotionState = {
  pivot: null,
  sample: null,
  lightPower: 0,
  onFrame: () => {
    repaintLabelLight();
  },
};

const measureSwayPivot = (): void => {
  const stage = stageRef.value;
  const motion = craftRigRef.value?.motionElement;
  if (!stage || !motion) {
    return;
  }

  const stageRect = stage.getBoundingClientRect();
  const rect = motion.getBoundingClientRect();
  swayBeamMotion.pivot = {
    pivotX: rect.left - stageRect.left + rect.width * 0.5,
    pivotY: rect.top - stageRect.top + rect.height * 0.85,
  };
  swayBeamMotion.sample ??= sampleBootSway(0);
  beamCraftReady.value = true;
  repaintLabelLight();
};

const handleEnterEnd = (): void => {
  onEnterAnimationEnd();
  nextTick(() => {
    measureSwayPivot();
  });
};

const onSwayFrame = (sample: BootSwaySample): void => {
  swayBeamMotion.sample = sample;
  if (!swayBeamMotion.pivot) {
    measureSwayPivot();
  }
};

watch(stepRevision, () => {
  nextTick(() => {
    measureSwayPivot();
    repaintLabelLight();
  });
});

onMounted(() => {
  void start();
});

const { t } = useI18n();

const labelText = computed(() => (stepKey.value ? t(stepKey.value) : ''));

const labelsVisible = computed(() => exitPhase.value === 'none' && enterComplete.value && Boolean(labelText.value));

const beamActive = computed(() => bootLightActive.value && labelsVisible.value && beamCraftReady.value);

const displayedLightPower = computed(() => (enterComplete.value && beamCraftReady.value ? lightPower.value : 0));

const beamAnchorTop = `${bootBeamAnchorTopPercent()}%`;

const stageChromeStyle = computed(() => ({
  '--boot-light': displayedLightPower.value,
  '--boot-beam-anchor-top': beamAnchorTop,
}));

watch(displayedLightPower, (power) => {
  swayBeamMotion.lightPower = power;
  repaintLabelLight();
});
</script>

<template>
  <div
    v-if="showOverlay"
    class="boot-screen bg-surface fixed inset-0 z-50 flex items-center justify-center"
    :class="{
      'boot-screen-labels-out': exitPhase === 'labels' || exitPhase === 'spin' || exitPhase === 'curtain',
      'boot-screen-curtain': exitPhase === 'curtain',
    }"
    role="status"
    aria-busy="true"
    aria-live="polite"
  >
    <div
      ref="stageRef"
      class="boot-stage"
      :style="stageChromeStyle"
    >
      <AppBootBeamLayer
        v-if="labelText"
        :active="beamActive"
        :stage="stageRef"
        :origin="beamOriginRef"
        :label="labelTargetRef"
        :sway-motion="swayBeamMotion"
      />

      <BootCraftRig
        ref="craftRigRef"
        :reduce-motion="reduceMotion"
        :sway-active="craftSwayActive"
        :sway-paused="swayFrozen"
        :neutral-gate-open="neutralGateOpen"
        :exit-spin="exitPhase === 'spin' || exitPhase === 'curtain'"
        :on-sway-frame="onSwayFrame"
        @enter-end="handleEnterEnd"
        @sway-neutral="onSwayNeutral"
      >
        <span
          ref="beamOriginRef"
          class="boot-beam-origin"
          aria-hidden="true"
        />
      </BootCraftRig>

      <div class="boot-label-slot">
        <p
          v-if="labelsVisible"
          :key="stepRevision"
          ref="labelTargetRef"
          class="boot-label boot-label-glass text-body-sm font-roboto"
          :class="snappyLightTransition ? 'boot-label-glass-snappy' : 'boot-label-glass-damped'"
        >
          <span class="boot-label-text">{{ labelText }}</span>
        </p>
        <p
          v-if="failed"
          class="text-body-x-sm font-roboto text-on-surface-dim boot-failed-message"
        >
          {{ t('studio.boot.failed') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.boot-screen {
  pointer-events: auto;
}

.boot-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(100%, 20rem);
  padding-inline: 1.5rem;
}

.boot-beam-origin {
  position: absolute;
  left: 50%;
  top: var(--boot-beam-anchor-top, 62.5%);
  width: 1px;
  height: 1px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  opacity: 0;
}

.boot-label-slot {
  position: relative;
  z-index: 2;
  margin-top: 0.75rem;
  min-height: 3.5rem;
  width: 100%;
  text-align: center;
  transition: opacity 0.22s ease-out;
}

.boot-screen-labels-out .boot-label-slot {
  opacity: 0;
  transition: opacity 0.22s ease-out;
}

.boot-screen-curtain {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.78s ease-out;
}

.boot-screen-curtain .boot-stage {
  transform: scale(1.02);
  opacity: 0;
  transition:
    opacity 0.55s ease-out,
    transform 0.78s cubic-bezier(0.22, 1, 0.36, 1);
}

.boot-label {
  margin: 0;
}

.boot-failed-message {
  margin-top: 0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .boot-label-slot {
    transition: none;
  }
}
</style>
