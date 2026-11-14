<script setup lang="ts">
const props = defineProps<{
  levelDb: number;
}>();

const FLOOR_DB = -60;
const SEGMENT_DB = 2;
const WARNING_DB = -20;
const ERROR_DB = -9;

const zoneClass = {
  accent: 'bg-accent',
  warning: 'bg-warning',
  error: 'bg-error',
} as const;

type MeterZone = keyof typeof zoneClass;

const segments = Array.from({ length: -FLOOR_DB / SEGMENT_DB }, (_, index) => {
  const bottom = FLOOR_DB + index * SEGMENT_DB;
  const top = bottom + SEGMENT_DB;
  const zone: MeterZone = top > ERROR_DB ? 'error' : top > WARNING_DB ? 'warning' : 'accent';
  return { bottom, zone };
});

const level = computed(() => Math.min(0, Math.max(FLOOR_DB, props.levelDb)));
</script>

<template>
  <div class="gap-tiny flex w-full flex-col">
    <div class="text-label text-on-surface-dim flex justify-between font-mono tabular-nums">
      <span>-60</span>
      <span>-30</span>
      <span>-9</span>
      <span>0</span>
    </div>
    <div class="h-x-sm gap-x-tiny flex">
      <span
        v-for="segment in segments"
        :key="segment.bottom"
        class="min-w-0 flex-1"
        :class="level > segment.bottom ? zoneClass[segment.zone] : 'bg-surface-container-high'"
      />
    </div>
  </div>
</template>
