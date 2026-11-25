<script setup lang="ts">
import { useStudioRecording } from '../../composables/useStudioRecording';
import { videoBitrateForFrame, type VideoBitratePreset } from '../../infrastructure/recording/recording-bitrate';
import { recordingNameFromPattern } from '../../infrastructure/recording/recording-filename';
import { containerSupported, type RecordingContainer } from '../../infrastructure/recording/recording-mime';
import { outputFrame } from '../../models/output-profile.domain';
import { useStudioSessionStore } from '../../store/studio-session.store';
import type { StudioOptionSelectChoice } from './studio-option-catalog';
import {
  optionBoxClass,
  optionGroupClass,
  optionLabelClass,
  optionReadoutRowClass,
  optionRowClass,
  optionTextActionClass,
} from './studio-option-classes';
import StudioOptionField from './StudioOptionField.vue';
import StudioOptionSelect from './StudioOptionSelect.vue';

const { t } = useI18n();
const store = useStudioSessionStore();
const recording = useStudioRecording();

const presets: VideoBitratePreset[] = ['low', 'standard', 'high', 'veryHigh'];
const containers: RecordingContainer[] = ['auto', 'webm', 'mp4'];
const nameDraft = ref(recording.namePattern.value);

const qualityChoices = computed<StudioOptionSelectChoice[]>(() =>
  presets.map((preset) => ({ value: preset, label: qualityLabel(preset) })),
);

const containerChoices = computed<StudioOptionSelectChoice[]>(() =>
  containers.map((container) => ({
    value: container,
    label: t(`studio.recording.containers.${container}`),
    disabled: !containerEnabled(container),
  })),
);

const locked = computed(
  () =>
    recording.state.value === 'recording' ||
    recording.state.value === 'paused' ||
    recording.state.value === 'preparing' ||
    recording.state.value === 'finalizing',
);

const measuredFps = computed(() =>
  recording.measuredFrameRate.value === null ? '—' : recording.measuredFrameRate.value.toFixed(2),
);

const typeSupported = (mimeType: string): boolean =>
  typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType);

const nextFileName = computed(() => {
  const extension = recording.container.value === 'mp4' ? 'mp4' : 'webm';
  return recordingNameFromPattern(nameDraft.value, store.project?.name ?? '', new Date(), extension);
});

const errorText = computed(() => {
  const code = recording.error.value;
  if (!code) {
    return '';
  }
  const key = `studio.recording.errors.${code}`;
  const translated = t(key);
  return translated === key ? code : translated;
});

watch(
  () => recording.namePattern.value,
  (value) => {
    nameDraft.value = value;
  },
);

function onQualityChange(value: string) {
  if (value === 'low' || value === 'standard' || value === 'high' || value === 'veryHigh') {
    recording.videoBitrate.value = value;
  }
}

function onContainerChange(value: string) {
  if (value === 'auto' || value === 'webm' || value === 'mp4') {
    recording.container.value = value;
  }
}

function commitName() {
  const next = nameDraft.value.trim();
  if (!next) {
    nameDraft.value = recording.namePattern.value;
    return;
  }
  recording.namePattern.value = next;
}

function qualityLabel(preset: VideoBitratePreset): string {
  const frame = outputFrame(store.project);
  const megabits = videoBitrateForFrame(preset, frame.width, frame.height) / 1_000_000;
  return `${t(`studio.recording.presets.${preset}`)} · ${megabits.toFixed(1)} Mb/s`;
}

function containerEnabled(container: RecordingContainer): boolean {
  if (container === 'auto') {
    return true;
  }
  return containerSupported(typeSupported, container);
}
</script>

<template>
  <section class="gap-xxx-sm mb-md flex flex-col">
    <h2 :class="optionGroupClass">
      {{ t('studio.options.groups.recording') }}
    </h2>
    <div :class="optionRowClass">
      <label
        :class="optionLabelClass"
        for="studio-recording-quality"
      >
        {{ t('studio.recording.quality') }}
      </label>
      <StudioOptionSelect
        id="studio-recording-quality"
        :model-value="recording.videoBitrate.value"
        :choices="qualityChoices"
        :disabled="locked"
        @update:model-value="onQualityChange"
      />
    </div>
    <div :class="optionRowClass">
      <label
        :class="optionLabelClass"
        for="studio-recording-container"
      >
        {{ t('studio.recording.container') }}
      </label>
      <StudioOptionSelect
        id="studio-recording-container"
        :model-value="recording.container.value"
        :choices="containerChoices"
        :disabled="locked"
        @update:model-value="onContainerChange"
      />
    </div>
    <div :class="optionRowClass">
      <label
        :class="optionLabelClass"
        for="studio-recording-name"
      >
        {{ t('studio.recording.name') }}
      </label>
      <input
        id="studio-recording-name"
        v-model="nameDraft"
        :class="optionBoxClass"
        :disabled="locked"
        spellcheck="false"
        aria-describedby="studio-recording-name-hint"
        @change="commitName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </div>
    <p
      id="studio-recording-name-hint"
      class="text-body-x-sm text-on-surface-dim max-w-[56rem] font-sans"
    >
      {{ t('studio.recording.nameHint') }}
    </p>
    <p class="text-body-sm text-on-surface max-w-[56rem] truncate font-sans tabular-nums">
      {{ nextFileName }}
    </p>
    <StudioOptionField
      :label="t('studio.options.fields.recordingPath')"
      :off="true"
      kind="text"
    />

    <h2 :class="[optionGroupClass, 'mt-xx-lg']">
      {{ t('studio.recording.title') }}
    </h2>
    <dl class="flex flex-col">
      <div :class="optionReadoutRowClass">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.state') }}</dt>
        <dd class="text-state text-on-surface font-sans">{{ recording.state.value }}</dd>
      </div>
      <div :class="optionReadoutRowClass">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.elapsed') }}</dt>
        <dd class="text-body-sm text-on-surface font-sans tabular-nums">{{ recording.elapsedLabel.value }}</dd>
      </div>
      <div :class="optionReadoutRowClass">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.frame') }}</dt>
        <dd class="text-body-sm text-on-surface font-sans tabular-nums">{{ recording.frameLabel.value }}</dd>
      </div>
      <div :class="optionReadoutRowClass">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.requestedFps') }}</dt>
        <dd class="text-body-sm text-on-surface font-sans tabular-nums">{{ recording.requestedFrameRate.value }}</dd>
      </div>
      <div :class="optionReadoutRowClass">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.measuredFps') }}</dt>
        <dd class="text-body-sm text-on-surface font-sans tabular-nums">{{ measuredFps }}</dd>
      </div>
      <div :class="optionReadoutRowClass">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.mime') }}</dt>
        <dd class="text-body-sm text-on-surface min-w-0 truncate font-sans">{{ recording.mimeType.value || '—' }}</dd>
      </div>
      <div :class="optionReadoutRowClass">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.audioBitrate') }}</dt>
        <dd class="text-body-sm text-on-surface font-sans tabular-nums">{{ recording.audioBitrate / 1000 }} kb/s</dd>
      </div>
    </dl>
    <p class="text-body-x-sm text-on-surface-dim max-w-[56rem] font-sans">
      {{ t('studio.recording.fpsHint') }}
    </p>
    <p
      v-if="recording.error.value"
      class="text-body-x-sm text-error font-sans"
      role="alert"
    >
      {{ errorText }}
    </p>

    <h2 :class="[optionGroupClass, 'mt-xx-lg']">
      {{ t('studio.recording.library') }}
    </h2>
    <p
      v-if="recording.recordings.value.length === 0"
      class="text-body-sm text-on-surface-dim font-sans"
    >
      {{ t('studio.recording.empty') }}
    </p>
    <ul
      v-else
      class="flex max-w-[56rem] flex-col"
    >
      <li
        v-for="item in recording.recordings.value"
        :key="item.id"
        class="border-line gap-md py-xxx-sm flex items-center justify-between border-b"
      >
        <div class="gap-x-tiny flex min-w-0 flex-col">
          <p class="text-body-sm text-on-surface truncate font-sans">{{ item.fileName }}</p>
          <p class="text-label text-on-surface-dim font-mono uppercase tabular-nums">
            {{ item.width }}×{{ item.height }} · {{ item.frameRate }} fps · {{ item.mimeType }}
          </p>
          <p
            v-if="!recording.canOpen(item)"
            class="text-body-x-sm text-on-surface-dim font-sans"
          >
            {{ t('studio.recording.noHandle') }}
          </p>
        </div>
        <button
          v-if="recording.canOpen(item)"
          type="button"
          :class="optionTextActionClass"
          @click="recording.openRecording(item)"
        >
          {{ t('studio.recording.open') }}
        </button>
      </li>
    </ul>
  </section>
</template>
