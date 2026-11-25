<script setup lang="ts">
import { cn } from '~/utils/index';

import { inspectorFocusRingClass } from '../properties-inspector/inspector-control-classes';
import type { OptionFieldKind } from './studio-option-catalog';
import { optionBoxClass, optionLabelClass, optionRowClass } from './studio-option-classes';
import StudioOptionSelect from './StudioOptionSelect.vue';

const props = defineProps<{
  label: string;
  off: boolean;
  kind: OptionFieldKind;
  text?: string;
  checked?: boolean;
  choices?: { value: string; label: string }[];
}>();

const { t } = useI18n();
const fieldId = useId();
</script>

<template>
  <div :class="optionRowClass">
    <label
      :class="optionLabelClass"
      :for="fieldId"
    >
      {{ label }}
    </label>
    <span
      v-if="kind === 'check'"
      class="flex min-w-0 flex-1 items-center"
    >
      <input
        :id="fieldId"
        type="checkbox"
        :class="
          cn(
            'border-line bg-surface checked:border-accent checked:bg-accent size-md shrink-0 cursor-pointer appearance-none border',
            'disabled:checked:bg-on-surface-dim disabled:cursor-not-allowed disabled:border-dashed disabled:checked:border-solid',
            inspectorFocusRingClass,
          )
        "
        :checked="checked"
        :disabled="props.off"
        @change.prevent
      />
    </span>
    <button
      v-else-if="kind === 'action'"
      :id="fieldId"
      type="button"
      :class="optionBoxClass"
      :disabled="props.off"
    />
    <StudioOptionSelect
      v-else-if="kind === 'select'"
      :id="fieldId"
      :model-value="text"
      :choices="choices ?? []"
      :disabled="props.off"
    />
    <input
      v-else
      :id="fieldId"
      :class="[optionBoxClass, kind === 'number' || kind === 'readout' ? 'tabular-nums' : '']"
      :type="kind === 'password' ? 'password' : 'text'"
      :inputmode="kind === 'number' ? 'decimal' : undefined"
      :value="text"
      autocomplete="off"
      :disabled="props.off"
      :readonly="kind === 'readout'"
    />
    <span
      v-if="off"
      class="text-label text-on-surface-dim w-[4.8rem] shrink-0 text-right font-mono uppercase"
    >
      {{ t('studio.options.off') }}
    </span>
  </div>
</template>
