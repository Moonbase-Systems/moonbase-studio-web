<script setup lang="ts">
const props = defineProps<{
  modelValue: number;
}>();

const emit = defineEmits<{
  change: [value: number];
}>();

const SEGMENT_COUNT = 20;
const segments = Array.from({ length: SEGMENT_COUNT }, (_, index) => ((index + 0.5) / SEGMENT_COUNT) * 100);

const percent = computed(() => Math.min(100, Math.max(0, props.modelValue * 100)));

function onInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value)) {
    return;
  }
  emit('change', value / 100);
}
</script>

<template>
  <div class="h-md relative w-full">
    <div class="h-tiny gap-x-tiny pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2">
      <span
        v-for="middle in segments"
        :key="middle"
        class="min-w-0 flex-1"
        :class="percent >= middle ? 'bg-accent' : 'bg-surface-container-high'"
      />
    </div>
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      class="peer absolute inset-0 cursor-pointer opacity-0"
      :value="percent"
      :aria-valuenow="Math.round(percent)"
      aria-valuemin="0"
      aria-valuemax="100"
      @input="onInput"
    />
    <span
      class="h-x-sm w-x-tiny bg-on-surface peer-focus-visible:ring-accent peer-focus-visible:ring-offset-surface pointer-events-none absolute top-1/2 -translate-y-1/2 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2"
      :style="{ left: `calc(${percent}% - 1px)` }"
    />
  </div>
</template>
