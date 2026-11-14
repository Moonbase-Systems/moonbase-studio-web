<script setup lang="ts">
import { provideStudioCompositionEngine } from '../../composables/useCompositionEngine';
import { useHistoryShortcuts } from '../../composables/useHistoryShortcuts';
import { useLayerStackShortcuts } from '../../composables/useLayerStackShortcuts';
import { AppBootScreen } from '../app-boot';
import { STUDIO_BOOT_REVEAL_KEY } from '../app-boot/studio-boot-chrome';
import { PropertiesInspector } from '../properties-inspector';
import { ScenesSidebar } from '../scenes-sidebar';
import { StudioTopBar } from '../studio-top-bar';
import ScenePreviewFrame from './ScenePreviewFrame.vue';

useHistoryShortcuts();
useLayerStackShortcuts();
provideStudioCompositionEngine();

const studioReveal = useState(STUDIO_BOOT_REVEAL_KEY, () => false);

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 560;
const SIDEBAR_DEFAULT = 256;
/** The preview gives way first on narrow windows; the inspector never drops below PROPERTIES_MIN. */
const PREVIEW_MIN = 240;
const PROPERTIES_MIN = 400;
const PROPERTIES_MAX = 760;
const PROPERTIES_DEFAULT = 460;

const { t } = useI18n();
const sidebarWidth = ref(SIDEBAR_DEFAULT);
const propertiesWidth = ref(PROPERTIES_DEFAULT);
const resizeTarget = ref<'sidebar' | 'properties' | null>(null);

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
    const row = (event.currentTarget as HTMLElement).closest('[data-workspace-row]');
    const rect = row instanceof HTMLElement ? row.getBoundingClientRect() : null;
    const right = rect?.right ?? window.innerWidth;
    const room = rect ? rect.width - sidebarWidth.value - PREVIEW_MIN : PROPERTIES_MAX;
    const max = Math.max(PROPERTIES_MIN, Math.min(PROPERTIES_MAX, room));
    propertiesWidth.value = Math.min(max, Math.max(PROPERTIES_MIN, right - event.clientX));
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
  <AppBootScreen />
  <div
    class="studio-workspace-shell bg-surface text-on-surface flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden font-sans"
    :class="{ 'studio-workspace-shell-reveal': studioReveal }"
  >
    <StudioTopBar />

    <div
      class="flex min-h-0 flex-1 overflow-hidden"
      data-workspace-row
    >
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
            class="bg-line group-hover/resize:bg-accent pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-[width,background-color] group-hover/resize:w-0.5"
            :class="resizeTarget === 'sidebar' && 'bg-accent w-0.5'"
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
      </div>

      <aside
        class="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden"
        data-properties-panel
        :style="{
          width: `${propertiesWidth}px`,
          minWidth: `${PROPERTIES_MIN}px`,
          maxWidth: `max(${PROPERTIES_MIN}px, calc(100% - ${sidebarWidth + PREVIEW_MIN}px))`,
        }"
      >
        <div
          role="separator"
          aria-orientation="vertical"
          :aria-valuenow="propertiesWidth"
          :aria-valuemin="PROPERTIES_MIN"
          :aria-valuemax="PROPERTIES_MAX"
          :aria-label="t('studio.properties.resize')"
          class="group/resize-properties absolute inset-y-0 left-0 z-10 w-2 -translate-x-1/2 cursor-col-resize touch-none"
          @pointerdown="onResizePointerDown('properties', $event)"
          @pointermove="onResizePointerMove"
          @pointerup="onResizePointerUp"
          @pointercancel="onResizePointerUp"
        >
          <span
            class="bg-line group-hover/resize-properties:bg-accent pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-[width,background-color] group-hover/resize-properties:w-0.5"
            :class="resizeTarget === 'properties' && 'bg-accent w-0.5'"
          />
        </div>

        <PropertiesInspector />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.studio-workspace-shell {
  opacity: 0;
  transform: scale(0.985);
  filter: blur(6px);
}

.studio-workspace-shell-reveal {
  opacity: 1;
  transform: scale(1);
  filter: blur(0);
  transition:
    opacity 0.78s ease-out,
    transform 0.85s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.7s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .studio-workspace-shell {
    opacity: 1;
    filter: none;
    transform: none;
  }

  .studio-workspace-shell-reveal {
    transition: none;
  }
}
</style>
