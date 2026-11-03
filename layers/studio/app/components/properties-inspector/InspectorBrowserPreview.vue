<script setup lang="ts">
import type { BrowserElement } from '../../models/scene-elements';
import { useStudioSessionStore } from '../../store/studio-session.store';

const props = defineProps<{
  element: BrowserElement;
}>();

const store = useStudioSessionStore();

const source = computed(() => {
  const linked = store.project?.sources.find((item) => item.id === props.element.sourceId);
  return linked?.type === 'browser' ? linked : null;
});

const pageUrl = computed(() => {
  const raw = source.value?.url;
  if (!raw) {
    return null;
  }
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href;
    }
  } catch {
    return null;
  }
  return null;
});

const frameStyle = computed(() => {
  const width = Math.max(source.value?.width ?? 1, 1);
  const height = Math.max(source.value?.height ?? 1, 1);
  const scale = Math.min(180 / width, 88 / height);
  return {
    width: `${width}px`,
    height: `${height}px`,
    transform: `scale(${scale})`,
  };
});
</script>

<template>
  <div class="relative h-[88px] w-full max-w-[180px] overflow-hidden bg-[color-mix(in_srgb,white_5%,#050004)]">
    <iframe
      v-if="pageUrl"
      :key="pageUrl"
      :src="pageUrl"
      title=""
      class="pointer-events-none absolute left-0 top-0 border-0"
      :style="frameStyle"
    />
  </div>
</template>
