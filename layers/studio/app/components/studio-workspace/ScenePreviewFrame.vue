<script setup lang="ts">
import { useStudioCompositionEngine } from '../../composables/useCompositionEngine';
import { useStudioAudioEngine } from '../../composables/useStudioAudioEngine';
import { channelAudibleInScene, normalizeLevelDb } from '../../models/audio.domain';
import { outputFrame } from '../../models/output-profile.domain';
import type { AudioVisualElement } from '../../models/scene-elements/audio-element.domain';
import { useStudioSessionStore } from '../../store/studio-session.store';
import { screenStreamRevision } from '../properties-inspector/screen-preview-stream';
import PreviewSignalField from './PreviewSignalField.vue';
import SceneBrowserFrames from './SceneBrowserFrames.vue';
import SceneTransformOverlay from './SceneTransformOverlay.vue';

const store = useStudioSessionStore();
const { t } = useI18n();
const compositionEngine = useStudioCompositionEngine();
const audioEngine = useStudioAudioEngine();
const { host, isReady, lastError } = compositionEngine;

const activeScene = computed(() => store.activeScene ?? undefined);

function onEmptyPreviewPointerDown(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (target.closest('button, input, select, textarea, a')) {
    return;
  }
  store.clearSelection();
}

function onPreviewPointerDown(event: PointerEvent) {
  onEmptyPreviewPointerDown(event);
  const root = event.currentTarget;
  const target = event.target;
  if (!(root instanceof HTMLElement) || !(target instanceof Element)) {
    return;
  }
  if (target.closest('input, textarea, select, button, a')) {
    return;
  }
  root.focus({ preventScroll: true });
}

const frame = computed(() => outputFrame(store.project));
const aspectValue = computed(() => {
  const v = frame.value;
  if (v.height === 0 || v.width === 0) {
    return 16 / 9;
  }
  return v.width / v.height;
});

/** Fit a 16:9 (or project) frame in the slot without stretching it into the column. */
const frameStyle = computed(() => ({
  aspectRatio: String(aspectValue.value),
  width: `min(100cqw, calc(100cqh * ${aspectValue.value}))`,
}));

const resolutionLabel = computed(() =>
  t('studio.preview.heading', {
    width: frame.value.width,
    height: frame.value.height,
  }),
);

const showPlaceholder = computed(() => !isReady.value || !store.activeScene);
const renderFailed = computed(() => lastError.value?.kind === 'render-failed');

const audioChannels = computed(() => {
  const scene = activeScene.value;
  const project = store.project;
  if (!scene || !project) {
    return [];
  }
  const enabled = new Set(
    scene.elements
      .filter((element): element is AudioVisualElement => element.type === 'audioVisual' && element.visibility)
      .map((element) => element.channelId),
  );
  return project.audioMixer.channels
    .filter((channel) => channelAudibleInScene(channel, enabled))
    .map((channel) => {
      const reading = audioEngine.levels.channels[channel.id];
      const db = reading?.rmsDb ?? -60;
      return {
        id: channel.id,
        label: channel.name,
        value: normalizeLevelDb(db),
        peak: normalizeLevelDb(reading?.peakDb ?? -60),
        readout: String(Math.round(db)),
      };
    });
});

const masterMeter = computed(() => {
  const reading = audioEngine.levels.master;
  const db = reading?.rmsDb ?? -60;
  return {
    value: normalizeLevelDb(db),
    peak: normalizeLevelDb(reading?.peakDb ?? -60),
    readout: String(Math.round(db)),
  };
});

const overlayMeter = computed(() => {
  const reading = audioEngine.levels.overlay;
  const db = reading?.rmsDb ?? -60;
  return {
    value: normalizeLevelDb(db),
    peak: normalizeLevelDb(reading?.peakDb ?? -60),
    readout: String(Math.round(db)),
  };
});

watch(
  [() => store.activeScene, () => store.project?.settings.outputProfile, isReady, screenStreamRevision],
  ([scene, , ready]) => {
    if (scene && ready) {
      void compositionEngine.render(scene);
    }
  },
);
</script>

<template>
  <div
    class="p-xx-lg gap-xx-lg focus-visible:ring-accent relative flex h-full min-h-0 flex-col overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset"
    data-scene-preview
    tabindex="0"
    @pointerdown="onPreviewPointerDown"
  >
    <div class="gap-md flex shrink-0 flex-wrap items-baseline justify-between">
      <div class="gap-tiny flex min-w-0 flex-col">
        <span class="text-label text-on-surface-dim font-mono uppercase">
          {{ resolutionLabel }}
        </span>
        <h1 class="text-title text-on-surface truncate font-sans font-light">
          {{ activeScene?.name ?? '—' }}
        </h1>
      </div>
      <BaseStatusBadge
        state="idle"
        :label="t('studio.preview.resting')"
      />
    </div>

    <div
      class="relative flex min-h-0 w-full flex-1 items-center justify-center"
      style="container-type: size"
    >
      <BaseFrame
        :active="Boolean(activeScene)"
        corners="all"
        class="relative max-h-full max-w-full bg-transparent p-0"
        :style="frameStyle"
      >
        <PreviewSignalField />
        <div
          ref="host"
          class="absolute inset-0 overflow-hidden"
          :class="{ invisible: !store.activeScene }"
          data-composition-host
        />
        <SceneBrowserFrames
          v-if="!showPlaceholder"
          :host="host"
        />
        <span
          v-if="showPlaceholder"
          class="text-body-sm text-on-surface-dim pointer-events-none absolute inset-0 flex items-center justify-center font-sans"
        >
          {{ t('studio.preview.placeholder') }}
        </span>
        <span
          v-if="renderFailed"
          class="text-body-x-sm text-on-surface-dim px-xxx-sm py-tiny absolute inset-x-0 bottom-0 font-sans"
          :title="lastError?.kind === 'render-failed' ? lastError.message : undefined"
        >
          {{ t('studio.preview.renderFailed') }}
        </span>
        <SceneTransformOverlay
          v-if="!showPlaceholder"
          :host="host"
        />
      </BaseFrame>
    </div>

    <section class="border-line gap-xxxx-lg pt-md flex shrink-0 flex-wrap items-end border-t">
      <div class="gap-x-sm flex min-w-0 flex-col">
        <span class="text-label text-on-surface-dim font-mono uppercase">
          {{ t('studio.preview.mixer') }}
        </span>
        <div class="gap-md flex items-end">
          <BaseLevelMeter
            v-for="channel in audioChannels"
            :key="channel.id"
            :value="channel.value"
            :peak="channel.peak"
            :label="channel.label"
            :readout="channel.readout"
          />
          <BaseLevelMeter
            :value="overlayMeter.value"
            :peak="overlayMeter.peak"
            :label="t('studio.audio.overlay.title')"
            :readout="overlayMeter.readout"
          />
          <BaseLevelMeter
            :value="masterMeter.value"
            :peak="masterMeter.peak"
            :label="t('studio.preview.master')"
            :readout="masterMeter.readout"
          />
        </div>
      </div>

      <div class="gap-x-sm ml-auto flex flex-wrap">
        <BaseMetric
          :label="t('studio.preview.metrics.fps')"
          :unit="t('studio.preview.metrics.fpsUnit')"
          :value="null"
        />
        <BaseMetric
          :label="t('studio.preview.metrics.bitrate')"
          :unit="t('studio.preview.metrics.bitrateUnit')"
          :value="null"
        />
        <BaseMetric
          :label="t('studio.preview.metrics.latency')"
          :unit="t('studio.preview.metrics.latencyUnit')"
          :value="null"
        />
        <BaseMetric
          :label="t('studio.preview.metrics.link')"
          :value="null"
        />
      </div>
    </section>
  </div>
</template>
