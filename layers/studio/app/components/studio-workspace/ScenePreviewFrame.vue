<script setup lang="ts">
import { useStudioSessionStore } from '../../store/studio-session.store';

const store = useStudioSessionStore();
const { t } = useI18n();

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
</script>

<template>
  <div
    class="px-md py-md flex h-full min-h-0 flex-col"
    data-scene-preview
    @pointerdown="onEmptyPreviewPointerDown"
  >
    <div class="flex min-h-0 flex-1 items-center justify-center">
      <div
        class="bg-surface-container-high border-on-surface-dim/30 relative max-h-full w-full max-w-full overflow-hidden rounded-sm border"
        :style="{ aspectRatio }"
      >
        <span class="text-body-sm font-roboto text-on-surface-dim absolute inset-0 flex items-center justify-center">
          {{ t('studio.preview.placeholder') }}
        </span>
      </div>
    </div>
  </div>
</template>
