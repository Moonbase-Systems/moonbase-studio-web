<script setup lang="ts">
import {
  formatAspectRatio,
  matchingOutputPreset,
  OUTPUT_PRESETS,
  type OutputPreset,
} from '../../models/output-profile.domain';
import { useStudioSessionStore } from '../../store/studio-session.store';
import { inspectorFocusRingClass } from '../properties-inspector/inspector-control-classes';
import { optionBoxClass, optionGroupClass, optionLabelClass, optionRowClass } from './studio-option-classes';

const { t } = useI18n();
const store = useStudioSessionStore();

const profile = computed(() => store.project?.settings.outputProfile ?? null);
const drafts = reactive({ name: '', width: '', height: '', frameRate: '' });
const formatError = ref('');

watch(
  profile,
  (value) => {
    if (!value) {
      return;
    }
    drafts.name = value.name;
    drafts.width = String(value.width);
    drafts.height = String(value.height);
    drafts.frameRate = String(value.frameRate);
    formatError.value = '';
  },
  { immediate: true },
);

const matchedPresetId = computed(() => {
  const current = profile.value;
  if (!current) {
    return null;
  }
  return matchingOutputPreset(current)?.id ?? null;
});

function revertDrafts(): void {
  const current = profile.value;
  if (!current) {
    return;
  }
  drafts.name = current.name;
  drafts.width = String(current.width);
  drafts.height = String(current.height);
  drafts.frameRate = String(current.frameRate);
}

function parsePositive(raw: string): number | null {
  const parsed = Number(raw.trim().replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function aspectBox(preset: OutputPreset): Record<string, string> {
  const ratio = `${preset.width} / ${preset.height}`;
  if (preset.width >= preset.height) {
    return { width: '100%', aspectRatio: ratio };
  }
  return { height: '100%', aspectRatio: ratio };
}

function applyPreset(presetId: string): void {
  formatError.value = '';
  store.applyOutputPreset(presetId);
}

function commitName(): void {
  const current = profile.value;
  if (!current) {
    return;
  }
  const name = drafts.name.trim();
  if (name.length === 0 || name.length > 128) {
    formatError.value = t('studio.options.outputFormat.invalid');
    revertDrafts();
    return;
  }
  formatError.value = '';
  if (name === current.name) {
    return;
  }
  store.updateOutputProfileName(name);
}

function commitNumber(key: 'width' | 'height' | 'frameRate'): void {
  const current = profile.value;
  if (!current) {
    return;
  }
  const parsed = parsePositive(drafts[key]);
  if (parsed === null) {
    formatError.value = t('studio.options.outputFormat.invalid');
    revertDrafts();
    return;
  }
  formatError.value = '';
  if (parsed === current[key]) {
    drafts[key] = String(current[key]);
    return;
  }
  store.updateOutputProfile({ [key]: parsed });
}
</script>

<template>
  <section class="gap-xxx-sm flex flex-col">
    <h3 :class="optionGroupClass">
      {{ t('studio.options.outputFormat.title') }}
    </h3>
    <div
      class="gap-xxx-sm grid max-w-[72rem] grid-cols-1 md:grid-cols-2"
      role="list"
    >
      <button
        v-for="preset in OUTPUT_PRESETS"
        :key="preset.id"
        type="button"
        role="listitem"
        :class="[
          'gap-x-sm px-x-sm py-xxx-sm duration-short relative flex items-center border text-left transition-colors',
          inspectorFocusRingClass,
          matchedPresetId === preset.id ? 'border-accent' : 'border-line hover:bg-surface-container-high',
        ]"
        :aria-pressed="matchedPresetId === preset.id"
        @click="applyPreset(preset.id)"
      >
        <span class="size-xxxx-lg flex shrink-0 items-center justify-center">
          <span
            class="max-h-full max-w-full border"
            :class="matchedPresetId === preset.id ? 'border-accent' : 'border-on-surface-dim'"
            :style="aspectBox(preset)"
          />
        </span>
        <span class="gap-x-tiny flex min-w-0 flex-col">
          <span
            class="text-body-sm block truncate font-sans"
            :class="matchedPresetId === preset.id ? 'text-accent' : 'text-on-surface'"
          >
            {{ preset.name }}
          </span>
          <span class="text-label text-on-surface-dim block font-mono uppercase tabular-nums">
            {{ preset.width }}×{{ preset.height }} · {{ formatAspectRatio(preset.width, preset.height) }} ·
            {{ preset.frameRate }} fps
          </span>
          <span class="text-body-x-sm text-on-surface-dim block truncate font-sans">
            {{ t(`studio.options.outputFormat.presets.${preset.id}`) }}
          </span>
        </span>
      </button>
    </div>

    <div :class="[optionRowClass, 'mt-md']">
      <label
        :class="optionLabelClass"
        for="studio-output-format-name"
      >
        {{ t('studio.options.outputFormat.name') }}
      </label>
      <input
        id="studio-output-format-name"
        v-model="drafts.name"
        :class="optionBoxClass"
        autocomplete="off"
        :disabled="!profile"
        @change="commitName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </div>
    <div
      v-for="key in ['width', 'height', 'frameRate'] as const"
      :key="key"
      :class="optionRowClass"
    >
      <label
        :class="optionLabelClass"
        :for="`studio-output-format-${key}`"
      >
        {{ t(`studio.options.outputFormat.${key}`) }}
      </label>
      <input
        :id="`studio-output-format-${key}`"
        v-model="drafts[key]"
        :class="[optionBoxClass, 'tabular-nums']"
        inputmode="decimal"
        autocomplete="off"
        :disabled="!profile"
        @change="commitNumber(key)"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
      <span
        class="text-label text-on-surface-dim w-[4.8rem] shrink-0 font-mono uppercase"
        aria-hidden="true"
      >
        {{ key === 'frameRate' ? 'fps' : 'px' }}
      </span>
    </div>
    <p
      v-if="formatError"
      class="text-body-x-sm text-error font-sans"
      role="alert"
    >
      {{ formatError }}
    </p>
  </section>
</template>
