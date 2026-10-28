<script setup lang="ts">
import { cn } from '~/utils/index';

import type { InspectorTabDefinition } from '../../application/inspector-sections';

const props = defineProps<{
  tabs: InspectorTabDefinition[];
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const { t } = useI18n();
</script>

<template>
  <div
    class="gap-x-tiny flex flex-nowrap"
    role="tablist"
  >
    <button
      v-for="tab in props.tabs"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="modelValue === tab.id"
      :class="
        cn(
          'font-roboto rounded-x-sm px-1.5 py-0 text-[11px] leading-5 transition-colors',
          modelValue === tab.id
            ? 'bg-accent/15 text-accent'
            : 'text-on-surface-dim hover:text-on-surface hover:bg-surface-inverted/5',
        )
      "
      @click="emit('update:modelValue', tab.id)"
    >
      {{ t(tab.labelKey) }}
    </button>
  </div>
</template>
