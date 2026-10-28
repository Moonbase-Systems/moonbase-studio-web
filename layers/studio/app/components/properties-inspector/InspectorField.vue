<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    error?: string | null;
    inline?: boolean;
  }>(),
  { inline: false, error: null },
);
</script>

<template>
  <label
    class="gap-sm"
    :class="inline ? 'flex flex-row items-center justify-end' : 'flex flex-col'"
  >
    <span
      class="font-roboto text-on-surface-dim whitespace-nowrap"
      :class="inline ? 'text-right text-[11px] leading-none' : 'text-body-sm'"
      >{{ label }}</span
    >
    <span :class="inline ? 'w-[4.75rem] shrink-0' : 'min-w-0'">
      <slot />
    </span>
    <span
      v-if="error"
      class="text-body-sm text-on-surface-dim"
    >
      {{ error }}
    </span>
  </label>
</template>
