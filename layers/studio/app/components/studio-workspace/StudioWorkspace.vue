<script setup lang="ts">
import { useStudioSessionStore } from '../../store/studio-session.store';
import { ScenesSidebar } from '../scenes-sidebar';
import { StudioTopBar } from '../studio-top-bar';

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 560;
const SIDEBAR_DEFAULT = 256;

const store = useStudioSessionStore();
const { t } = useI18n();
const sidebarWidth = ref(SIDEBAR_DEFAULT);
const resizing = ref(false);

onMounted(() => {
  if (!store.isInitialized) {
    store.initialize();
  }
  if (!store.project) {
    store.createProject({ name: 'MoonBase' });
  }
});

function onResizePointerDown(event: PointerEvent) {
  const handle = event.currentTarget;
  if (!(handle instanceof HTMLElement)) {
    return;
  }
  resizing.value = true;
  handle.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onResizePointerMove(event: PointerEvent) {
  if (!resizing.value) {
    return;
  }
  const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, event.clientX));
  sidebarWidth.value = next;
}

function onResizePointerUp(event: PointerEvent) {
  if (!resizing.value) {
    return;
  }
  resizing.value = false;
  const handle = event.currentTarget;
  if (handle instanceof HTMLElement && handle.hasPointerCapture(event.pointerId)) {
    handle.releasePointerCapture(event.pointerId);
  }
}
</script>

<template>
  <div class="bg-surface text-on-surface font-roboto flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden">
    <StudioTopBar />

    <div class="flex min-h-0 flex-1 overflow-hidden">
      <div
        class="px-md py-md relative flex h-full min-h-0 shrink-0 flex-col"
        :style="{ width: `${sidebarWidth}px` }"
      >
        <ScenesSidebar />

        <div
          role="separator"
          aria-orientation="vertical"
          :aria-valuenow="sidebarWidth"
          :aria-valuemin="SIDEBAR_MIN"
          :aria-valuemax="SIDEBAR_MAX"
          :aria-label="t('studio.sceneList.resize')"
          class="group/resize absolute inset-y-0 right-0 z-10 w-2 translate-x-1/2 cursor-col-resize touch-none"
          @pointerdown="onResizePointerDown"
          @pointermove="onResizePointerMove"
          @pointerup="onResizePointerUp"
          @pointercancel="onResizePointerUp"
        >
          <span
            class="bg-accent pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-[width] group-hover/resize:w-0.5"
            :class="resizing && 'w-0.5'"
          />
        </div>
      </div>
    </div>
  </div>
</template>
