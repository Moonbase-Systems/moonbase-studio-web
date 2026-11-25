<script setup lang="ts">
import { useStudioRecording } from '../../composables/useStudioRecording';
import { videoBitrateForFrame, type VideoBitratePreset } from '../../infrastructure/recording/recording-bitrate';
import { recordingNameFromPattern } from '../../infrastructure/recording/recording-filename';
import { containerSupported, type RecordingContainer } from '../../infrastructure/recording/recording-mime';
import { outputFrame } from '../../models/output-profile.domain';
import { useStudioSessionStore } from '../../store/studio-session.store';

const { t } = useI18n();
const store = useStudioSessionStore();
const recording = useStudioRecording();

const presets: VideoBitratePreset[] = ['low', 'standard', 'high', 'veryHigh'];
const containers: RecordingContainer[] = ['auto', 'webm', 'mp4'];
const nameDraft = ref(recording.namePattern.value);

const fieldClass =
  'border-line text-body-sm text-on-surface focus-visible:border-accent h-row px-xxx-sm min-w-0 flex-1 border bg-transparent font-sans outline-none focus-visible:ring-0';

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

function onQualityChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  if (value === 'low' || value === 'standard' || value === 'high' || value === 'veryHigh') {
    recording.videoBitrate.value = value;
  }
}

function onContainerChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
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
  <section class="gap-md mb-lg flex flex-col">
    <h2 class="text-label text-on-surface-dim font-mono uppercase">
      {{ t('studio.options.groups.recording') }}
    </h2>
    <label class="gap-md flex items-center">
      <span class="text-body-sm text-on-surface-dim w-[16rem] shrink-0 font-sans">
        {{ t('studio.recording.quality') }}
      </span>
      <select
        :class="fieldClass"
        :value="recording.videoBitrate.value"
        :disabled="locked"
        @change="onQualityChange"
      >
        <option
          v-for="preset in presets"
          :key="preset"
          :value="preset"
        >
          {{ qualityLabel(preset) }}
        </option>
      </select>
    </label>
    <label class="gap-md flex items-center">
      <span class="text-body-sm text-on-surface-dim w-[16rem] shrink-0 font-sans">
        {{ t('studio.recording.container') }}
      </span>
      <select
        :class="fieldClass"
        :value="recording.container.value"
        :disabled="locked"
        @change="onContainerChange"
      >
        <option
          v-for="container in containers"
          :key="container"
          :value="container"
          :disabled="!containerEnabled(container)"
        >
          {{ t(`studio.recording.containers.${container}`) }}
        </option>
      </select>
    </label>
    <label class="gap-md flex items-center">
      <span class="text-body-sm text-on-surface-dim w-[16rem] shrink-0 font-sans">
        {{ t('studio.recording.name') }}
      </span>
      <input
        v-model="nameDraft"
        :class="fieldClass"
        :disabled="locked"
        spellcheck="false"
        @change="commitName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </label>
    <p class="text-body-sm text-on-surface-dim font-sans">
      {{ t('studio.recording.nameHint') }}
    </p>
    <p class="text-body-sm text-on-surface font-sans tabular-nums">
      {{ nextFileName }}
    </p>
    <StudioOptionField
      :label="t('studio.options.fields.recordingPath')"
      :off="true"
      kind="text"
    />

    <h2 class="text-label text-on-surface-dim mt-lg font-mono uppercase">
      {{ t('studio.recording.title') }}
    </h2>
    <dl class="gap-xxx-sm flex flex-col">
      <div class="gap-md flex items-baseline justify-between">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.state') }}</dt>
        <dd class="text-body-sm text-on-surface font-sans">{{ recording.state.value }}</dd>
      </div>
      <div class="gap-md flex items-baseline justify-between">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.elapsed') }}</dt>
        <dd class="text-body-sm text-on-surface font-sans tabular-nums">{{ recording.elapsedLabel.value }}</dd>
      </div>
      <div class="gap-md flex items-baseline justify-between">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.frame') }}</dt>
        <dd class="text-body-sm text-on-surface font-sans tabular-nums">{{ recording.frameLabel.value }}</dd>
      </div>
      <div class="gap-md flex items-baseline justify-between">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.requestedFps') }}</dt>
        <dd class="text-body-sm text-on-surface font-sans tabular-nums">{{ recording.requestedFrameRate.value }}</dd>
      </div>
      <div class="gap-md flex items-baseline justify-between">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.measuredFps') }}</dt>
        <dd class="text-body-sm text-on-surface font-sans tabular-nums">{{ measuredFps }}</dd>
      </div>
      <div class="gap-md flex items-baseline justify-between">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.mime') }}</dt>
        <dd class="text-body-sm text-on-surface font-sans">{{ recording.mimeType.value || '—' }}</dd>
      </div>
      <div class="gap-md flex items-baseline justify-between">
        <dt class="text-body-sm text-on-surface-dim font-sans">{{ t('studio.recording.audioBitrate') }}</dt>
        <dd class="text-body-sm text-on-surface font-sans tabular-nums">{{ recording.audioBitrate / 1000 }} kb/s</dd>
      </div>
    </dl>
    <p class="text-body-sm text-on-surface-dim font-sans">
      {{ t('studio.recording.fpsHint') }}
    </p>
    <p
      v-if="recording.error.value"
      class="text-body-sm text-error font-sans"
    >
      {{ errorText }}
    </p>

    <h2 class="text-label text-on-surface-dim mt-lg font-mono uppercase">
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
      class="flex flex-col"
    >
      <li
        v-for="item in recording.recordings.value"
        :key="item.id"
        class="border-line gap-md py-xxx-sm flex items-center justify-between border-b"
      >
        <div class="min-w-0">
          <p class="text-body-sm text-on-surface truncate font-sans">{{ item.fileName }}</p>
          <p class="text-label text-on-surface-dim font-mono">
            {{ item.width }}×{{ item.height }} · {{ item.frameRate }} fps · {{ item.mimeType }}
          </p>
          <p
            v-if="!recording.canOpen(item)"
            class="text-body-sm text-on-surface-dim font-sans"
          >
            {{ t('studio.recording.noHandle') }}
          </p>
        </div>
        <button
          v-if="recording.canOpen(item)"
          type="button"
          class="text-body-sm text-accent font-sans"
          @click="recording.openRecording(item)"
        >
          {{ t('studio.recording.open') }}
        </button>
      </li>
    </ul>
  </section>
</template>
