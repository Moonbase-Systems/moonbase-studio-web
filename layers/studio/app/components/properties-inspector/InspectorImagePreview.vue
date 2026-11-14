<script setup lang="ts">
import { cn, inspectorTypography } from '~/utils/index';

import type { ImageElement } from '../../models/scene-elements';
import { useStudioSessionStore } from '../../store/studio-session.store';
import { peekImagePreviewUrl } from './image-preview-url';

const props = defineProps<{
  element: ImageElement;
}>();

const { t } = useI18n();
const store = useStudioSessionStore();
const failed = ref(false);

const linkedAsset = computed(() => {
  const source = store.project?.sources.find((item) => item.id === props.element.sourceId);
  if (!source || source.type !== 'image') {
    return null;
  }
  return store.project?.assets.find((item) => item.id === source.assetId) ?? null;
});

const imageUrl = computed(() => {
  const asset = linkedAsset.value;
  if (!asset || asset.availability === 'missing') {
    return null;
  }
  const held = peekImagePreviewUrl(asset.id);
  if (held) {
    return held;
  }
  if (asset.location.kind !== 'remoteUrl') {
    return null;
  }
  return asset.location.url;
});

watch(imageUrl, () => {
  failed.value = false;
});

const frameStyle = computed(() => {
  const width = Math.max(props.element.transform.width, 1);
  const radius = (props.element.settings.cornerRadius / width) * 160;
  return {
    borderRadius: `${radius}px`,
  };
});

const imageStyle = computed(() => ({
  objectFit: props.element.settings.fitMode,
  imageRendering: props.element.settings.smoothing ? ('auto' as const) : ('pixelated' as const),
}));
</script>

<template>
  <div
    class="border-line flex h-[88px] w-full max-w-[180px] items-center justify-center overflow-hidden border"
    :style="frameStyle"
  >
    <img
      v-if="imageUrl && !failed"
      :src="imageUrl"
      alt=""
      class="size-full"
      :style="imageStyle"
      @error="failed = true"
    />
    <p
      v-else
      :class="cn(inspectorTypography.body, 'px-x-sm text-on-surface-dim text-center')"
    >
      {{ t('studio.properties.assetMissing') }}
    </p>
  </div>
</template>
