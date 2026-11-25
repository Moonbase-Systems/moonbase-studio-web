<script setup lang="ts">
import { computed } from 'vue';

import { alertText, type OverlayAlert } from '../../application/overlay-alerts';

const props = defineProps<{
  alert: OverlayAlert;
}>();

const text = computed(() => alertText(props.alert));

function hideImage(event: Event) {
  const image = event.target;
  if (image instanceof HTMLImageElement) {
    image.style.display = 'none';
  }
}
</script>

<template>
  <article
    class="border-line bg-surface gap-md px-xx-lg py-xx-lg pointer-events-none flex w-full items-center border"
    data-overlay-alert
  >
    <img
      v-if="text.avatarUrl"
      :src="text.avatarUrl"
      alt=""
      class="h-[clamp(4.8rem,16vw,12.8rem)] w-[clamp(4.8rem,16vw,12.8rem)] shrink-0 object-cover"
      referrerpolicy="no-referrer"
      @error="hideImage"
    />
    <div class="gap-xx-sm flex min-w-0 flex-1 flex-col">
      <p class="text-label-lg text-accent font-mono uppercase">
        {{ $t(`studio.audio.overlay.events.${alert.type}`) }}
      </p>
      <p
        class="text-on-surface line-clamp-3 break-words font-sans text-[clamp(4.8rem,12vw,9.6rem)] font-light leading-[0.95]"
      >
        {{ $t(`overlayLab.alerts.${alert.type}`, { name: text.name }) }}
      </p>
      <p
        v-if="text.line"
        class="text-body-lg text-on-surface-dim line-clamp-2 break-words font-sans"
      >
        {{ text.line }}
      </p>
    </div>
  </article>
</template>
