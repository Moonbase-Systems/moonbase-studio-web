<script setup lang="ts">
import { cn } from '~/utils/index';

defineProps<{
  modelValue: number;
  edge: 'top' | 'right' | 'bottom' | 'left';
  disabled?: boolean;
}>();

const emit = defineEmits<{
  change: [value: string];
}>();

const edgeClass: Record<string, string> = {
  top: 'border-t-2 border-t-[#22FF86]',
  right: 'border-r-2 border-r-[#22FF86]',
  bottom: 'border-b-2 border-b-[#22FF86]',
  left: 'border-l-2 border-l-[#22FF86]',
};
</script>

<template>
  <div class="flex items-center gap-[8px]">
    <span
      class="size-[20px] shrink-0 border border-[#787878]"
      :class="edgeClass[edge]"
      aria-hidden="true"
    />
    <input
      type="text"
      inputmode="decimal"
      :value="modelValue"
      :disabled="disabled"
      :class="
        cn(
          'font-inter text-body-sm font-medium tracking-normal',
          'h-[24px] w-[20px] shrink-0 border-0 bg-[color-mix(in_srgb,white_5%,#050004)] px-[2px] text-center text-white outline-none',
        )
      "
      @change="emit('change', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
