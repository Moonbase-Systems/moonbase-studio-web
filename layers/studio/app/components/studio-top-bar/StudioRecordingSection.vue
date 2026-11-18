<script setup lang="ts">
import { useStudioRecording } from '../../composables/useStudioRecording';
import type { VideoBitratePreset } from '../../infrastructure/recording/recording-bitrate';

const { t } = useI18n();
const recording = useStudioRecording();

const presets: VideoBitratePreset[] = ['low', 'standard', 'high', 'veryHigh'];

const measuredFps = computed(() =>
  recording.measuredFrameRate.value === null ? '—' : recording.measuredFrameRate.value.toFixed(2),
);

function onBitrateChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  if (value === 'low' || value === 'standard' || value === 'high' || value === 'veryHigh') {
    recording.videoBitrate.value = value;
  }
}
</script>

<template>
  <section class="gap-md mb-lg flex flex-col">
    <h2 class="text-label text-on-surface-dim font-mono uppercase">
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
      {{ recording.error.value }}
    </p>
    <label class="gap-md flex items-center">
      <span class="text-body-sm text-on-surface-dim w-[16rem] shrink-0 font-sans">
        {{ t('studio.recording.bitrate') }}
      </span>
      <select
        class="border-line text-body-sm text-on-surface focus-visible:border-accent h-row px-xxx-sm min-w-0 flex-1 border bg-transparent font-sans outline-none"
        :value="recording.videoBitrate.value"
        :disabled="recording.state.value === 'recording' || recording.state.value === 'paused'"
        @change="onBitrateChange"
      >
        <option
          v-for="preset in presets"
          :key="preset"
          :value="preset"
        >
          {{ t(`studio.recording.presets.${preset}`) }}
        </option>
      </select>
    </label>

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
