<script setup lang="ts">
import { inspectorLabelClass } from './inspector-control-classes';

const props = defineProps<{
  modelValue: number;
}>();

const emit = defineEmits<{
  change: [value: number];
}>();

const SEGMENT_COUNT = 20;
const segments = Array.from({ length: SEGMENT_COUNT }, (_, index) => ((index + 0.5) / SEGMENT_COUNT) * 100);

const percent = computed(() => ((Math.min(1, Math.max(-1, props.modelValue)) + 1) / 2) * 100);

function isLit(middle: number) {
  return middle >= Math.min(50, percent.value) && middle <= Math.max(50, percent.value);
}

function onInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value)) {
    return;
  }
  emit('change', Math.min(1, Math.max(-1, value / 50 - 1)));
}

const sideLabelClass = inspectorLabelClass;
</script>

<template>
  <div class="gap-xxx-sm flex w-[112px] items-center">
    <span :class="sideLabelClass">L</span>
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
        :aria-valuenow="Math.round(props.modelValue * 100)"
        aria-valuemin="-100"
        aria-valuemax="100"
        aria-label="L R"
        @input="onInput"
      />
      <span
        class="h-x-sm w-x-tiny bg-on-surface peer-focus-visible:ring-accent peer-focus-visible:ring-offset-surface pointer-events-none absolute top-1/2 -translate-y-1/2 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2"
        :style="{ left: `calc(${percent}% - 1px)` }"
      />
    </div>
    <span :class="sideLabelClass">R</span>
  </div>
</template>
