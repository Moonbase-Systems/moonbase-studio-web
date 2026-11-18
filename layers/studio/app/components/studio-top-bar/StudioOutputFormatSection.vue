<script setup lang="ts">
import {
  formatAspectRatio,
  matchingOutputPreset,
  OUTPUT_PRESETS,
  type OutputPreset,
} from '../../models/output-profile.domain';
import { useStudioSessionStore } from '../../store/studio-session.store';

const { t } = useI18n();
const store = useStudioSessionStore();

const profile = computed(() => store.project?.settings.outputProfile ?? null);
const drafts = reactive({ name: '', width: '', height: '', frameRate: '' });
const formatError = ref('');

const fieldClass =
  'border-line text-body-sm text-on-surface focus-visible:border-accent h-row px-xxx-sm min-w-0 flex-1 border bg-transparent font-sans outline-none focus-visible:ring-0';

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
    <h3 class="text-label text-on-surface-dim font-mono uppercase">
      {{ t('studio.options.outputFormat.title') }}
    </h3>
    <div
      class="gap-xxx-sm grid grid-cols-2"
      role="list"
    >
      <button
        v-for="preset in OUTPUT_PRESETS"
        :key="preset.id"
        type="button"
        role="listitem"
        class="gap-xxx-sm border-line px-xxx-sm py-xxx-sm focus-visible:ring-accent flex items-center border text-left outline-none focus-visible:ring-2"
        :class="matchedPresetId === preset.id ? 'border-accent' : 'hover:bg-surface-container-high'"
        :aria-pressed="matchedPresetId === preset.id"
        @click="applyPreset(preset.id)"
      >
        <span class="border-line flex h-10 w-10 shrink-0 items-center justify-center border">
          <span
            class="bg-accent/30 max-h-full max-w-full"
            :style="aspectBox(preset)"
          />
        </span>
        <span class="min-w-0">
          <span class="text-body-sm text-on-surface block truncate font-sans">{{ preset.name }}</span>
          <span class="text-label text-on-surface-dim block font-mono">
            {{ preset.width }}×{{ preset.height }} · {{ formatAspectRatio(preset.width, preset.height) }} ·
            {{ preset.frameRate }} fps
          </span>
          <span class="text-label text-on-surface-dim block truncate font-sans">
            {{ t(`studio.options.outputFormat.presets.${preset.id}`) }}
          </span>
        </span>
      </button>
    </div>

    <label class="gap-md mt-lg flex items-center">
      <span class="text-body-sm text-on-surface-dim w-[22rem] shrink-0 font-sans">
        {{ t('studio.options.outputFormat.name') }}
      </span>
      <input
        v-model="drafts.name"
        :class="fieldClass"
        autocomplete="off"
        :disabled="!profile"
        @change="commitName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </label>
    <label
      v-for="key in ['width', 'height', 'frameRate'] as const"
      :key="key"
      class="gap-md flex items-center"
    >
      <span class="text-body-sm text-on-surface-dim w-[22rem] shrink-0 font-sans">
        {{ t(`studio.options.outputFormat.${key}`) }}
      </span>
      <input
        v-model="drafts[key]"
        :class="[fieldClass, 'tabular-nums']"
        inputmode="decimal"
        autocomplete="off"
        :disabled="!profile"
        @change="commitNumber(key)"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </label>
    <p
      v-if="formatError"
      class="text-body-sm text-accent font-sans"
      role="alert"
    >
      {{ formatError }}
    </p>
  </section>
</template>
