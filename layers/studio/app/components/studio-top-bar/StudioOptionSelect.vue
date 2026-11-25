<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport,
} from 'reka-ui';

import { cn } from '~/utils/index';

import { inspectorChevronClass, inspectorMenuItemClass } from '../properties-inspector/inspector-control-classes';
import type { StudioOptionSelectChoice } from './studio-option-catalog';
import { optionBoxClass } from './studio-option-classes';

const props = withDefaults(
  defineProps<{
    choices: StudioOptionSelectChoice[];
    id?: string;
    disabled?: boolean;
  }>(),
  {
    id: undefined,
    disabled: false,
  },
);

/** Current value; a label is accepted too (catalog rows that store the shown text). */
const model = defineModel<string>({ default: '' });

const open = ref(false);

const current = computed(() =>
  props.choices.find((choice) => choice.value === model.value || choice.label === model.value),
);

const selectValue = computed({
  get: () => current.value?.value,
  set: (value) => {
    if (typeof value === 'string') {
      model.value = value;
    }
  },
});

const shownText = computed(() => current.value?.label ?? model.value);
</script>

<template>
  <SelectRoot
    v-model="selectValue"
    v-model:open="open"
    :disabled="disabled"
  >
    <SelectTrigger
      :id="id"
      :class="cn(optionBoxClass, 'cursor-pointer text-left disabled:cursor-not-allowed')"
    >
      <span class="min-w-0 flex-1 truncate">{{ shownText }}</span>
      <span
        :class="cn(inspectorChevronClass, open && 'rotate-90')"
        aria-hidden="true"
      >
        &gt;
      </span>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        class="border-line bg-surface-container p-tiny z-50 flex max-h-[min(32rem,var(--reka-select-content-available-height))] w-[var(--reka-select-trigger-width)] min-w-[16rem] flex-col border"
      >
        <SelectViewport class="gap-x-tiny flex flex-col">
          <SelectItem
            v-for="choice in choices"
            :key="choice.value"
            :value="choice.value"
            :disabled="choice.disabled"
            :class="
              cn(
                inspectorMenuItemClass(choice.value === current?.value),
                'cursor-pointer outline-none',
                'data-[highlighted]:bg-surface-container-high',
                'data-[disabled]:text-on-surface-dim data-[disabled]:cursor-not-allowed data-[disabled]:hover:bg-transparent',
              )
            "
          >
            <SelectItemText class="truncate">{{ choice.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
