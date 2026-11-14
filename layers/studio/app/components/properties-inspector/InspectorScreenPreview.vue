<script setup lang="ts">
import { cn, inspectorTypography } from '~/utils/index';

import type { ScreenElement } from '../../models/scene-elements';
import { peekScreenPreviewStream } from './screen-preview-stream';

const props = defineProps<{
  element: ScreenElement;
}>();

const { t } = useI18n();
const host = ref<HTMLVideoElement | null>(null);
const failed = ref(false);

const stream = computed(() => peekScreenPreviewStream(props.element.sourceId) ?? null);

function resume() {
  const video = host.value;
  const current = stream.value;
  if (!video || !current) {
    return;
  }
  // The element keeps its last black frame after a minimised window returns until the stream is attached again.
  video.srcObject = null;
  video.srcObject = current;
  void video.play().catch(() => undefined);
}

watch([host, stream], ([, current], _previous, onCleanup) => {
  const video = host.value;
  failed.value = false;
  if (!video) {
    return;
  }
  video.srcObject = current;
  if (!current) {
    return;
  }
  void video.play().catch(() => {
    failed.value = true;
  });
  // A minimised window mutes the capture; playback has to pick up again once it returns.
  const tracks = current.getVideoTracks();
  for (const track of tracks) {
    track.addEventListener('unmute', resume);
  }
  onCleanup(() => {
    for (const track of tracks) {
      track.removeEventListener('unmute', resume);
    }
  });
});
</script>

<template>
  <div class="border-line flex h-[88px] w-full max-w-[180px] items-center justify-center overflow-hidden border">
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
      :class="cn(inspectorTypography.body, 'px-x-sm text-on-surface-dim text-center')"
    >
      {{ t('studio.properties.screen.choose') }}
    </p>
  </div>
</template>
