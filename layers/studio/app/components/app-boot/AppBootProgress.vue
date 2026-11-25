<script setup lang="ts">
import { cn } from '~/utils/index';

import { BOOT_STAGES, type BootStage } from './boot-stages';

const props = withDefaults(
  defineProps<{
    stage: BootStage;
    failed?: boolean;
    /** Every step is done (exit is running). */
    complete?: boolean;
  }>(),
  {
    failed: false,
    complete: false,
  },
);

/** Charge-style bar, as in the Orbit SegmentBar. */
const SEGMENTS = 20;

const { t } = useI18n();

const stageIndex = computed(() => BOOT_STAGES.indexOf(props.stage));

const progress = computed(() => {
  if (props.complete) {
    return 1;
  }
  return (stageIndex.value + 0.5) / BOOT_STAGES.length;
});

const litCount = computed(() => Math.round(progress.value * SEGMENTS));

const readout = computed(() => {
  if (props.failed) {
    return t('studio.boot.error');
  }
  return `${Math.min(stageIndex.value + 1, BOOT_STAGES.length)} / ${BOOT_STAGES.length}`;
});

const segmentIndexes = Array.from({ length: SEGMENTS }, (_, index) => index);

function segmentClass(index: number): string {
  const lit = index < litCount.value;
  const head = lit && index === litCount.value - 1 && !props.failed && !props.complete;
  return cn(
    'h-md min-w-0 flex-1 transition-colors duration-medium ease-out',
    !lit && 'bg-surface-container-high',
    lit && (props.failed ? 'bg-error' : 'bg-accent'),
    head && 'bg-accent-dim',
  );
}

function stepClass(index: number): string {
  if (props.failed && index === stageIndex.value) {
    return 'text-error';
  }
  if (props.complete || index < stageIndex.value) {
    return 'text-on-surface-dim';
  }
  if (index === stageIndex.value) {
    return 'text-accent';
  }
  return 'text-line';
}
</script>

<template>
  <div class="gap-x-sm flex w-full flex-col">
    <div
      role="meter"
      :aria-label="t('studio.boot.progress')"
      :aria-valuemin="0"
      :aria-valuemax="1"
      :aria-valuenow="progress"
      :aria-valuetext="readout"
      class="gap-xxx-sm flex flex-col"
    >
      <div class="gap-md flex items-baseline justify-between">
        <span class="text-label text-on-surface-dim font-mono uppercase">{{ t('studio.boot.progress') }}</span>
        <span
          class="text-state font-sans tabular-nums"
          :class="failed ? 'text-error' : 'text-on-surface'"
        >
          {{ readout }}
        </span>
      </div>
      <div class="gap-x-tiny flex">
        <span
          v-for="index in segmentIndexes"
          :key="index"
          :class="segmentClass(index)"
        />
      </div>
    </div>
    <ol class="gap-xxx-sm grid grid-cols-4">
      <li
        v-for="(bootStage, index) in BOOT_STAGES"
        :key="bootStage"
        class="text-label duration-medium truncate font-mono uppercase transition-colors"
        :class="stepClass(index)"
        :aria-current="index === stageIndex && !complete ? 'step' : undefined"
      >
        {{ t(`studio.boot.${bootStage}`) }}
      </li>
    </ol>
  </div>
</template>
