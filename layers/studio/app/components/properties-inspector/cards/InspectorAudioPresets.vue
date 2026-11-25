<script setup lang="ts">
import {
  channelMatchesPreset,
  effectMatchesTemplate,
  SYSTEM_CHANNEL_PRESETS,
} from '../../../models/audio-preset.domain';
import type { ChannelId } from '../../../models/ids.domain';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import {
  inspectorFieldShellClass,
  inspectorLabelClass,
  inspectorRowClass,
  inspectorToggleClass,
} from '../inspector-control-classes';

const props = defineProps<{
  channelId: ChannelId;
}>();

const { t } = useI18n();
const store = useStudioSessionStore();
const presetName = ref('');
const presetError = ref('');

const channel = computed(() => store.project?.audioMixer.channels.find((item) => item.id === props.channelId));
const userPresets = computed(() => store.project?.audioMixer.presets ?? []);

const appliedChannelIds = computed(() => {
  const current = channel.value;
  const ids = new Set<string>();
  if (!current) {
    return ids;
  }
  for (const preset of SYSTEM_CHANNEL_PRESETS) {
    if (channelMatchesPreset(current, preset)) {
      ids.add(preset.id);
    }
  }
  for (const preset of userPresets.value) {
    if (preset.kind === 'channel' && channelMatchesPreset(current, preset)) {
      ids.add(preset.id);
    }
  }
  return ids;
});

function effectPresetApplied(preset: (typeof userPresets.value)[number]): boolean {
  if (preset.kind !== 'effect' || !channel.value) {
    return false;
  }
  const target = channel.value.effects.find((effect) => effect.type === preset.effect.type);
  return Boolean(target && effectMatchesTemplate(target, preset.effect));
}

function presetApplied(preset: (typeof userPresets.value)[number]): boolean {
  return preset.kind === 'channel' ? appliedChannelIds.value.has(preset.id) : effectPresetApplied(preset);
}

function saveChannel() {
  const name = presetName.value.trim();
  if (!name) {
    presetError.value = t('studio.audio.presetNameRequired');
    return;
  }
  const saved = store.saveAudioChannelPreset(props.channelId, name);
  if (!saved.ok) {
    presetError.value = t('studio.audio.presetNameRequired');
    return;
  }
  presetName.value = '';
  presetError.value = '';
}

function effectPresetBlocked(preset: (typeof userPresets.value)[number]): boolean {
  return preset.kind === 'effect' && !channel.value?.effects.some((effect) => effect.type === preset.effect.type);
}

function applyPreset(presetId: string, kind: 'channel' | 'effect', effectType?: string) {
  if (kind === 'channel') {
    store.applyAudioChannelPreset(props.channelId, presetId);
    return;
  }
  const target = channel.value?.effects.find((effect) => effect.type === effectType);
  if (!target || !effectType) {
    return;
  }
  store.applyAudioEffectPreset({ scope: 'channel', channelId: props.channelId }, target.id, presetId);
}
</script>

<template>
  <section class="border-line gap-xxx-sm pt-sm flex w-full min-w-0 flex-col border-t">
    <h3 :class="inspectorLabelClass">{{ t('studio.audio.presetLibrary') }}</h3>
    <p class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.audio.startingPoint') }}</p>
    <div
      v-for="preset in SYSTEM_CHANNEL_PRESETS"
      :key="preset.id"
      :class="inspectorRowClass"
    >
      <span class="min-w-0 flex-1">
        <span class="block font-sans">{{ preset.name }}</span>
        <span class="text-on-surface-dim block font-sans">{{ t(preset.descriptionKey) }}</span>
      </span>
      <button
        type="button"
        :class="inspectorToggleClass(appliedChannelIds.has(preset.id))"
        :aria-pressed="appliedChannelIds.has(preset.id)"
        @click="applyPreset(preset.id, 'channel')"
      >
        {{ appliedChannelIds.has(preset.id) ? t('studio.audio.presetApplied') : t('studio.audio.applyPreset') }}
      </button>
    </div>

    <div :class="inspectorRowClass">
      <label
        class="sr-only"
        for="channel-preset-name"
      >
        {{ t('studio.audio.presetName') }}
      </label>
      <input
        id="channel-preset-name"
        v-model="presetName"
        type="text"
        maxlength="64"
        :class="inspectorFieldShellClass"
        :placeholder="t('studio.audio.presetName')"
        :aria-invalid="presetError !== ''"
        @input="presetError = ''"
        @keydown.enter.prevent="saveChannel"
      />
      <button
        type="button"
        :class="inspectorToggleClass(false)"
        @click="saveChannel"
      >
        {{ t('studio.audio.savePreset') }}
      </button>
    </div>
    <p
      v-if="presetError"
      role="status"
      aria-atomic="true"
      class="text-body-sm text-on-surface font-sans"
    >
      {{ presetError }}
    </p>

    <div
      v-for="preset in userPresets"
      :key="preset.id"
      :class="inspectorRowClass"
    >
      <span class="min-w-0 flex-1 truncate font-sans">{{ preset.name }}</span>
      <button
        type="button"
        :class="inspectorToggleClass(presetApplied(preset), effectPresetBlocked(preset))"
        :aria-pressed="presetApplied(preset)"
        :disabled="effectPresetBlocked(preset)"
        @click="applyPreset(preset.id, preset.kind, preset.kind === 'effect' ? preset.effect.type : undefined)"
      >
        {{ presetApplied(preset) ? t('studio.audio.presetApplied') : t('studio.audio.applyPreset') }}
      </button>
      <button
        type="button"
        :class="inspectorToggleClass(false)"
        @click="store.removeAudioPreset(preset.id)"
      >
        {{ t('studio.audio.deletePreset') }}
      </button>
    </div>
  </section>
</template>
