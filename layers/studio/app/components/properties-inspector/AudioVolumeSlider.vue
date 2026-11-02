<script setup lang="ts">
const props = defineProps<{
  modelValue: number;
}>();

const emit = defineEmits<{
  change: [value: number];
}>();

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
  <div class="relative h-[18px] w-full">
    <div class="absolute top-1/2 h-[4px] w-full -translate-y-1/2 rounded-full bg-white" />
    <div
      class="absolute top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-[#22FF86]"
      :style="{ width: `${percent}%` }"
    />
    <input
      type="range"
      min="0"
      max="100"
      step="1"
      class="absolute inset-0 cursor-pointer opacity-0"
      :value="percent"
      :aria-valuenow="Math.round(percent)"
      aria-valuemin="0"
      aria-valuemax="100"
      @input="onInput"
    />
    <span
      class="pointer-events-none absolute top-1/2 size-[14px] -translate-y-1/2 rounded-full bg-[#22FF86]"
      :style="{ left: `calc(${percent}% - 7px)` }"
    />
  </div>
</template>
