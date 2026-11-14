<script setup lang="ts">
import { useStudioCompositionEngine } from '../../composables/useCompositionEngine';
import { useSceneAudioLevel } from '../../composables/useSceneAudioLevel';
import { useStudioSessionStore } from '../../store/studio-session.store';
import PreviewSignalField from './PreviewSignalField.vue';
import SceneTransformOverlay from './SceneTransformOverlay.vue';

const FLOOR_DB = -60;

const store = useStudioSessionStore();
const { t } = useI18n();
const compositionEngine = useStudioCompositionEngine();
const { host, isReady, lastError } = compositionEngine;

const activeScene = computed(() => store.activeScene ?? undefined);
const { levels } = useSceneAudioLevel(activeScene);

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

const video = computed(() => store.project?.settings.video);
const aspectValue = computed(() => {
  const v = video.value;
  if (!v || v.height === 0 || v.width === 0) {
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
    width: video.value?.width ?? 1920,
    height: video.value?.height ?? 1080,
  }),
);

const showPlaceholder = computed(() => !isReady.value || !store.activeScene);
const renderFailed = computed(() => lastError.value?.kind === 'render-failed');

const audioChannels = computed(() => {
  const scene = activeScene.value;
  if (!scene) {
    return [];
  }
  return scene.elements
    .filter((element) => element.type === 'audioVisual')
    .map((element) => {
      const db = levels[element.id] ?? FLOOR_DB;
      const normalized = Math.max(0, Math.min(1, (db - FLOOR_DB) / -FLOOR_DB));
      return {
        id: element.id,
        label: element.name,
        value: normalized,
        readout: String(Math.round(db)),
      };
    });
});

watch([() => store.activeScene, isReady], ([scene, ready]) => {
  if (scene && ready) {
    void compositionEngine.render(scene);
  }
});
</script>

<template>
  <div
    class="p-xx-lg gap-xx-lg relative flex h-full min-h-0 flex-col overflow-hidden"
    data-scene-preview
    @pointerdown="onEmptyPreviewPointerDown"
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
        <div
          v-if="audioChannels.length > 0"
          class="gap-md flex items-end"
        >
          <BaseLevelMeter
            v-for="channel in audioChannels"
            :key="channel.id"
            :value="channel.value"
            :label="channel.label"
            :readout="channel.readout"
          />
        </div>
        <p
          v-else
          class="text-body-sm text-on-surface-dim font-sans"
        >
          {{ t('studio.preview.mixerEmpty') }}
        </p>
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
