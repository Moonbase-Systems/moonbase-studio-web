<script setup lang="ts">
import { useHistoryShortcuts } from '../../composables/useHistoryShortcuts';
import { useStudioSessionStore } from '../../store/studio-session.store';
import { PropertiesInspector } from '../properties-inspector';
import { ScenesSidebar } from '../scenes-sidebar';
import { StudioTopBar } from '../studio-top-bar';
import ScenePreviewFrame from './ScenePreviewFrame.vue';

useHistoryShortcuts();

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 560;
const SIDEBAR_DEFAULT = 256;
const PREVIEW_MIN = 180;
const PROPERTIES_MIN = 96;
const PROPERTIES_DEFAULT = 148;

const store = useStudioSessionStore();
const { t } = useI18n();
const sidebarWidth = ref(SIDEBAR_DEFAULT);
const propertiesHeight = ref(PROPERTIES_DEFAULT);
const resizeTarget = ref<'sidebar' | 'properties' | null>(null);

onMounted(() => {
  if (!store.isInitialized) {
    store.initialize();
  }
  if (!store.project) {
    store.createProject({ name: 'MoonBase' });
  }
});

function onResizePointerDown(target: 'sidebar' | 'properties', event: PointerEvent) {
  const handle = event.currentTarget;
  if (!(handle instanceof HTMLElement)) {
    return;
  }
  resizeTarget.value = target;
  handle.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function onResizePointerMove(event: PointerEvent) {
  if (resizeTarget.value === 'sidebar') {
    sidebarWidth.value = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, event.clientX));
    return;
  }
  if (resizeTarget.value === 'properties') {
    const column = (event.currentTarget as HTMLElement).closest('[data-editor-column]');
    const bottom = column instanceof HTMLElement ? column.getBoundingClientRect().bottom : event.clientY;
    const max = Math.max(
      PROPERTIES_MIN,
      bottom - (column instanceof HTMLElement ? column.getBoundingClientRect().top : 0) - PREVIEW_MIN,
    );
    propertiesHeight.value = Math.min(max, Math.max(PROPERTIES_MIN, bottom - event.clientY));
  }
}

function onResizePointerUp(event: PointerEvent) {
  if (!resizeTarget.value) {
    return;
  }
  resizeTarget.value = null;
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
          @pointerdown="onResizePointerDown('sidebar', $event)"
          @pointermove="onResizePointerMove"
          @pointerup="onResizePointerUp"
          @pointercancel="onResizePointerUp"
        >
          <span
            class="bg-accent pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-[width] group-hover/resize:w-0.5"
            :class="resizeTarget === 'sidebar' && 'w-0.5'"
          />
        </div>
      </div>

      <div
        class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        data-editor-column
      >
        <div class="min-h-0 flex-1">
          <ScenePreviewFrame />
        </div>

        <div
          role="separator"
          aria-orientation="horizontal"
          :aria-valuenow="propertiesHeight"
          :aria-valuemin="PROPERTIES_MIN"
          :aria-label="t('studio.properties.resize')"
          class="group/resize-properties relative z-10 h-2 shrink-0 cursor-row-resize touch-none"
          @pointerdown="onResizePointerDown('properties', $event)"
          @pointermove="onResizePointerMove"
          @pointerup="onResizePointerUp"
          @pointercancel="onResizePointerUp"
        >
          <span
            class="bg-accent pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 transition-[height] group-hover/resize-properties:h-0.5"
            :class="resizeTarget === 'properties' && 'h-0.5'"
          />
        </div>

        <div
          class="shrink-0 overflow-hidden"
          data-properties-panel
          :style="{ height: `${propertiesHeight}px` }"
        >
          <PropertiesInspector />
        </div>
      </div>
    </div>
  </div>
</template>
