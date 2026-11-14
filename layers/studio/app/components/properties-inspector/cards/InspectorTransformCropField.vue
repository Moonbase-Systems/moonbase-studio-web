<script setup lang="ts">
import { cn, inspectorTypography } from '~/utils/index';

defineProps<{
  modelValue: number;
  edge: 'top' | 'right' | 'bottom' | 'left';
  /** Accessible name of the edge, e.g. "Góra". */
  label?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  change: [value: string];
}>();

const edgeClass: Record<string, string> = {
  top: 'border-t-2 border-t-accent',
  right: 'border-r-2 border-r-accent',
  bottom: 'border-b-2 border-b-accent',
  left: 'border-l-2 border-l-accent',
};
</script>

<template>
  <label
    class="h-row border-line px-tiny gap-xxx-sm duration-short hover:border-on-surface-dim focus-within:border-accent flex min-w-0 items-center border transition-colors"
  >
    <span
      class="size-md border-on-surface-dim shrink-0 border"
      :class="edgeClass[edge]"
      aria-hidden="true"
    />
    <input
      type="text"
      inputmode="decimal"
      :value="modelValue"
      :disabled="disabled"
      :aria-label="label"
      :class="
        cn(
          inspectorTypography.value,
          'text-on-surface disabled:text-on-surface-dim w-full min-w-0 border-0 bg-transparent p-0 outline-none',
        )
      "
      @change="emit('change', ($event.target as HTMLInputElement).value)"
    />
    <span class="text-label text-on-surface-dim shrink-0 font-mono uppercase">px</span>
  </label>
</template>
