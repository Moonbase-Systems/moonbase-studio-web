<script setup lang="ts">
import { cn, inspectorTypography } from '~/utils/index';

import { useAnimationPlayback } from '../../composables/useAnimationPlayback';
import type { SceneId } from '../../models/ids.domain';
import type { AnimationElement } from '../../models/scene-elements';
import {
  createAnimationPlayer,
  holdAnimationPlayer,
  releaseAnimationPlayer,
} from '../../playback/animation-player-registry';
import { peekAnimationPreviewUrl } from '../../playback/animation-preview-url';
import { useStudioSessionStore } from '../../store/studio-session.store';

const props = defineProps<{
  sceneId: SceneId;
  element: AnimationElement;
}>();

const { t } = useI18n();
const store = useStudioSessionStore();
const host = ref<HTMLElement | null>(null);
const failed = ref(false);

const source = computed(() => {
  const linked = store.project?.sources.find((item) => item.id === props.element.sourceId);
  return linked?.type === 'animation' ? linked : null;
});

const mediaUrl = computed(() => {
  const assetId = source.value?.assetId;
  if (!assetId) {
    return null;
  }
  const held = peekAnimationPreviewUrl(assetId);
  if (held) {
    return held;
  }
  const asset = store.project?.assets.find((item) => item.id === assetId);
  if (!asset || asset.location.kind !== 'remoteUrl') {
    return null;
  }
  return asset.location.url;
});

const playback = useAnimationPlayback(
  props.sceneId,
  () => props.element,
  () => source.value,
);

function mountPlayer() {
  releaseAnimationPlayer(props.element.id);
  const root = host.value;
  const current = source.value;
  const url = mediaUrl.value;
  if (!root || !current || !url) {
    return;
  }
  failed.value = false;
  const player = createAnimationPlayer(current.mediaKind, url);
  player.element.className = 'size-full object-contain';
  player.element.addEventListener('error', () => {
    failed.value = true;
  });
  root.replaceChildren(player.element);
  holdAnimationPlayer(props.element.id, player);
  playback.bindEnded();
  playback.armAutomatic();
}

watch([host, mediaUrl, () => source.value?.mediaKind], () => {
  mountPlayer();
});

onUnmounted(() => {
  playback.clearTimers();
  releaseAnimationPlayer(props.element.id);
});
</script>

<template>
  <div class="border-line flex h-[88px] w-full max-w-[180px] items-center justify-center overflow-hidden border">
    <div
      v-show="mediaUrl && !failed"
      ref="host"
      class="size-full"
    />
    <p
      v-if="!mediaUrl || failed"
      :class="cn(inspectorTypography.body, 'px-x-sm text-on-surface-dim text-center')"
    >
      {{ source?.assetId ? t('studio.properties.assetMissing') : t('studio.properties.animation.noFile') }}
    </p>
  </div>
</template>
