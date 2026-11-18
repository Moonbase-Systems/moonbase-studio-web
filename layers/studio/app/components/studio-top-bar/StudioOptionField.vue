<script setup lang="ts">
import type { OptionFieldKind } from './studio-option-catalog';

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

const controlClass =
  'border-line text-body-sm text-on-surface focus-visible:border-accent h-row px-xxx-sm min-w-0 flex-1 border bg-transparent font-sans outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:border-dashed disabled:text-on-surface-dim';
</script>

<template>
  <div class="gap-md flex items-center">
    <label
      class="gap-md flex min-w-0 flex-1 items-center"
      :for="fieldId"
    >
      <span class="text-body-sm text-on-surface-dim w-[22rem] shrink-0 truncate font-sans">
        {{ label }}
      </span>
      <input
        v-if="kind === 'check'"
        :id="fieldId"
        type="checkbox"
        class="border-line accent-accent size-4 shrink-0 border bg-transparent disabled:cursor-not-allowed"
        :checked="checked"
        :disabled="props.off"
        @change.prevent
      />
      <button
        v-else-if="kind === 'action'"
        :id="fieldId"
        type="button"
        :class="controlClass"
        :disabled="props.off"
      />
      <select
        v-else-if="kind === 'select'"
        :id="fieldId"
        :class="controlClass"
        :value="text"
        :disabled="props.off"
      >
        <option
          v-for="choice in choices"
          :key="choice.value"
          :value="choice.value"
        >
          {{ choice.label }}
        </option>
      </select>
      <input
        v-else
        :id="fieldId"
        :class="[controlClass, kind === 'number' || kind === 'readout' ? 'tabular-nums' : '']"
        :type="kind === 'password' ? 'password' : 'text'"
        :inputmode="kind === 'number' ? 'decimal' : undefined"
        :value="text"
        autocomplete="off"
        :disabled="props.off"
        :readonly="kind === 'readout'"
      />
    </label>
    <span
      v-if="off"
      class="text-label text-on-surface-dim w-[4.8rem] shrink-0 text-right font-mono uppercase"
    >
      {{ t('studio.options.off') }}
    </span>
  </div>
</template>
