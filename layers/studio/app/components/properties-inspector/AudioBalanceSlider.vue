<script setup lang="ts">
const props = defineProps<{
  modelValue: number;
}>();

const emit = defineEmits<{
  change: [value: number];
}>();

const percent = computed(() => ((Math.min(1, Math.max(-1, props.modelValue)) + 1) / 2) * 100);

function onInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(value)) {
    return;
  }
  emit('change', Math.min(1, Math.max(-1, value / 50 - 1)));
}
</script>

<template>
  <div class="flex w-[112px] items-center gap-[6px]">
    <span class="font-inter text-body-sm font-medium tracking-normal text-white">L</span>
    <div class="relative h-[12px] min-w-0 flex-1">
      <div
        class="pointer-events-none absolute inset-x-[5px] top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-white/25"
      />
      <div
        class="pointer-events-none absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[#22FF86]"
        :style="{ left: '5px', width: `calc((100% - 10px) * ${percent} / 100)` }"
      />
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        class="absolute inset-x-[5px] inset-y-0 cursor-pointer opacity-0"
        :value="percent"
        :aria-valuenow="Math.round(props.modelValue * 100)"
        aria-valuemin="-100"
        aria-valuemax="100"
        aria-label="L R"
        @input="onInput"
      />
      <span
        class="pointer-events-none absolute top-1/2 size-[10px] -translate-y-1/2 rounded-full bg-white"
        :style="{ left: `calc((100% - 10px) * ${percent} / 100)` }"
      />
    </div>
    <span class="font-inter text-body-sm font-medium tracking-normal text-white">R</span>
  </div>
</template>
