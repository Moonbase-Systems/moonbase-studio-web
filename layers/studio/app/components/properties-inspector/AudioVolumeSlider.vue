<script setup lang="ts">
import { FADER_DB_MAX, FADER_DB_MIN } from '../../models/audio.domain';
import { inspectorLabelClass } from './inspector-control-classes';

const props = defineProps<{
  modelValue: number;
  /** Stretch across the parent. The inspector row keeps the short balance-sized track. */
  wide?: boolean;
}>();

const emit = defineEmits<{
  change: [value: number];
}>();

const SPAN = FADER_DB_MAX - FADER_DB_MIN;
const SEGMENT_COUNT = 20;
const segments = Array.from({ length: SEGMENT_COUNT }, (_, index) => ((index + 0.5) / SEGMENT_COUNT) * 100);

const percent = computed(() => {
  const db = Math.min(FADER_DB_MAX, Math.max(FADER_DB_MIN, props.modelValue));
  return ((db - FADER_DB_MIN) / SPAN) * 100;
});

function isLit(middle: number) {
  return middle <= percent.value;
}

function onInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value)) {
    return;
  }
  const db = FADER_DB_MIN + (value / 100) * SPAN;
  const snapped = Math.round(db * 2) / 2;
  emit('change', Math.min(FADER_DB_MAX, Math.max(FADER_DB_MIN, snapped)));
}

const sideLabelClass = inspectorLabelClass;
</script>

<template>
  <div
    class="gap-xxx-sm flex items-center"
    :class="wide ? 'w-full' : 'w-[112px]'"
  >
    <span :class="sideLabelClass">−</span>
    <div class="h-x-sm relative min-w-0 flex-1">
      <div class="h-tiny gap-x-tiny pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2">
        <span
          v-for="middle in segments"
          :key="middle"
          class="min-w-0 flex-1"
          :class="isLit(middle) ? 'bg-accent' : 'bg-surface-container-high'"
        />
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        class="peer absolute inset-0 cursor-pointer opacity-0"
        :value="percent"
        :aria-valuenow="Math.round(props.modelValue)"
        :aria-valuemin="FADER_DB_MIN"
        :aria-valuemax="FADER_DB_MAX"
        aria-label="dB"
        @input="onInput"
      />
      <span
        class="h-x-sm w-x-tiny bg-on-surface peer-focus-visible:ring-accent peer-focus-visible:ring-offset-surface pointer-events-none absolute top-1/2 -translate-y-1/2 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2"
        :style="{ left: `calc(${percent}% - 1px)` }"
      />
    </div>
    <span :class="sideLabelClass">+</span>
  </div>
</template>
