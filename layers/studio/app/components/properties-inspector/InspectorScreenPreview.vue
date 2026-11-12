<script setup lang="ts">
import { cn } from '~/utils/index';

import type { ScreenElement } from '../../models/scene-elements';
import { peekScreenPreviewStream } from './screen-preview-stream';

const props = defineProps<{
  element: ScreenElement;
}>();

const { t } = useI18n();
const host = ref<HTMLVideoElement | null>(null);
const failed = ref(false);

const stream = computed(() => peekScreenPreviewStream(props.element.sourceId) ?? null);

watch([host, stream], () => {
  const video = host.value;
  failed.value = false;
  if (!video) {
    return;
  }
  video.srcObject = stream.value;
  if (stream.value) {
    void video.play().catch(() => {
      failed.value = true;
    });
  }
});
</script>

<template>
  <div
    class="flex h-[88px] w-full max-w-[180px] items-center justify-center overflow-hidden bg-[color-mix(in_srgb,white_5%,#050004)]"
  >
    <video
      v-show="stream && !failed"
      ref="host"
      class="size-full"
      :style="{ objectFit: element.settings.fitMode }"
      muted
      playsinline
      autoplay
      @error="failed = true"
    />
    <p
      v-if="!stream || failed"
      :class="cn('font-inter text-body-sm px-[12px] text-center font-medium text-white')"
    >
      {{ t('studio.properties.screen.choose') }}
    </p>
  </div>
</template>
