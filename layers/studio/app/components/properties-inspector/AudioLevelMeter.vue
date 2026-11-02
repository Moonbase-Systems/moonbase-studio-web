<script setup lang="ts">
const props = defineProps<{
  levelDb: number;
}>();

const marker = computed(() => {
  const clamped = Math.min(0, Math.max(-60, props.levelDb));
  return ((clamped + 60) / 60) * 100;
});
</script>

<template>
  <div class="flex w-full flex-col gap-[4px]">
    <div class="text-on-surface-dim font-inter flex justify-between text-[10px] leading-none">
      <span>-60</span>
      <span>-30</span>
      <span>-9</span>
      <span>0</span>
    </div>
    <div
      class="relative h-[12px] overflow-hidden rounded-[2px] bg-[linear-gradient(90deg,#123d22_0%,#1c5a30_42%,#6b5a16_68%,#6a3414_82%,#5c1616_100%)]"
    >
      <span
        class="absolute inset-y-0 w-[2px] bg-[#22FF86] shadow-[0_0_6px_#22FF86]"
        :style="{ left: `calc(${marker}% - 1px)` }"
      />
    </div>
  </div>
</template>
