<script setup lang="ts">
import { useStudioCompositionEngine } from '../../composables/useCompositionEngine';
import { useStudioSessionStore } from '../../store/studio-session.store';
import SceneTransformOverlay from './SceneTransformOverlay.vue';

const store = useStudioSessionStore();
const { t } = useI18n();
const compositionEngine = useStudioCompositionEngine();
const { host, isReady, lastError } = compositionEngine;

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
const aspectRatio = computed(() => {
  const v = video.value;
  if (!v || v.height === 0) {
    return '16 / 9';
  }
  return `${v.width} / ${v.height}`;
});

const showPlaceholder = computed(() => !isReady.value || !store.activeScene);
const renderFailed = computed(() => lastError.value?.kind === 'render-failed');

watch([() => store.activeScene, isReady], ([scene, ready]) => {
  if (scene && ready) {
    void compositionEngine.render(scene);
  }
});
</script>

<template>
  <div
    class="px-md py-md relative flex h-full min-h-0 flex-col overflow-hidden"
    data-scene-preview
    @pointerdown="onEmptyPreviewPointerDown"
  >
    <div class="flex min-h-0 flex-1 items-center justify-center">
      <div
        class="border-line bg-surface relative max-h-full w-full max-w-full overflow-hidden border"
        :style="{ aspectRatio }"
      >
        <div
          ref="host"
          class="absolute inset-0"
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
      </div>
    </div>
    <SceneTransformOverlay
      v-if="!showPlaceholder"
      :host="host"
    />
  </div>
</template>
