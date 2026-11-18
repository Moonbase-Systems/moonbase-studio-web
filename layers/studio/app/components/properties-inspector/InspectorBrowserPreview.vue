<script setup lang="ts">
import { outputFrame } from '../../models/output-profile.domain';
import type { BrowserElement } from '../../models/scene-elements';
import {
  browserCropPlacement,
  browserLayoutSize,
  browserLayoutZoom,
  browserPageViewport,
  resolveBrowserPageUrl,
} from '../../schemas/browser-source.schema';
import { useStudioSessionStore } from '../../store/studio-session.store';

const props = defineProps<{
  element: BrowserElement;
}>();

const store = useStudioSessionStore();

const source = computed(() => {
  const linked = store.project?.sources.find((item) => item.id === props.element.sourceId);
  return linked?.type === 'browser' ? linked : null;
});

const pageUrl = computed(() => resolveBrowserPageUrl(source.value?.url));

const frameStyle = computed(() => {
  const box = props.element.transform;
  const scale = Math.min(180 / Math.max(box.width, 1), 88 / Math.max(box.height, 1));
  return {
    width: `${box.width}px`,
    height: `${box.height}px`,
    transform: `scale(${scale})`,
    transformOrigin: '0 0',
  };
});

const pageStyle = computed(() => {
  const box = props.element.transform;
  const linked = source.value;
  const video = store.project ? outputFrame(store.project) : { width: box.width, height: box.height };
  const viewport = linked ? browserPageViewport(linked, video) : { width: box.width, height: box.height };
  const layout = browserLayoutSize(viewport.width, viewport.height, linked ? browserLayoutZoom(linked) : undefined);
  const placement = browserCropPlacement(box, layout, props.element.crop);
  return {
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    transform: `matrix(${placement.a}, 0, 0, ${placement.d}, ${placement.tx}, ${placement.ty})`,
  };
});
</script>

<template>
  <div class="border-line relative h-[88px] w-full max-w-[180px] overflow-hidden border">
    <div
      v-if="pageUrl"
      class="pointer-events-none absolute left-0 top-0 overflow-hidden"
      :style="frameStyle"
    >
      <div
        class="pointer-events-none absolute left-0 top-0"
        :style="pageStyle"
      >
        <iframe
          :key="pageUrl"
          :src="pageUrl"
          :title="element.name"
          allow="autoplay"
          class="pointer-events-none absolute left-0 top-0 border-0 bg-transparent"
          :style="{ width: pageStyle.width, height: pageStyle.height }"
        />
      </div>
    </div>
  </div>
</template>
