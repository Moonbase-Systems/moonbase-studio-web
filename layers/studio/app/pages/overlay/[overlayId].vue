<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue';

import {
  type AlertQueueState,
  clearAlertQueue,
  emptyAlertQueue,
  pushAlert,
  tickAlertQueue,
} from '../../application/overlay-alert-queue';
import OverlayAlertCard from '../../components/overlay-lab/OverlayAlertCard.vue';
import { getOverlayEventPort } from '../../composables/useOverlayEventPort';

definePageMeta({
  layout: false,
  pageTransition: false,
  layoutTransition: false,
});

const { t } = useI18n();
const route = useRoute();
const title = computed(() => t('overlayLab.rendererTitle'));

useHead({
  title,
  htmlAttrs: { class: 'theme-dark', style: 'background: transparent' },
  bodyAttrs: { style: 'background: transparent; margin: 0; overflow: hidden' },
});

const overlayId = computed(() => {
  const raw = route.params.overlayId;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value : '';
});
const valid = computed(() => /^[a-zA-Z0-9_-]{1,64}$/.test(overlayId.value));
const state = ref<AlertQueueState>(emptyAlertQueue());
let port: ReturnType<typeof getOverlayEventPort> | null = null;
let frame = 0;
let stop = () => {};
let beat: ReturnType<typeof setInterval> | null = null;

function publish() {
  if (!valid.value || !port) {
    return;
  }
  port.publish({
    kind: 'renderer',
    overlayId: overlayId.value,
    phase: state.value.phase,
    alert: state.value.phase === 'idle' ? null : state.value.current,
    queued: state.value.pending.length,
    at: Date.now(),
  });
}

function pump(now: number) {
  const next = tickAlertQueue(state.value, now);
  if (next !== state.value) {
    state.value = next;
    publish();
  }
  if (state.value.current) {
    frame = requestAnimationFrame(pump);
  } else {
    frame = 0;
  }
}

onMounted(() => {
  port = getOverlayEventPort();
  stop = port.subscribe((message) => {
    if (!valid.value) {
      return;
    }
    if (message.kind === 'clear-queue' && message.overlayId === overlayId.value) {
      state.value = clearAlertQueue();
      if (frame) {
        cancelAnimationFrame(frame);
      }
      frame = 0;
      publish();
      return;
    }
    if (message.kind === 'alert' && message.alert.overlayId === overlayId.value) {
      state.value = pushAlert(state.value, message.alert, performance.now());
      publish();
      if (!frame) {
        frame = requestAnimationFrame(pump);
      }
    }
  });

  if (valid.value) {
    port.publish({ kind: 'presence', role: 'renderer', overlayId: overlayId.value, at: Date.now() });
    publish();
  }

  beat = setInterval(() => {
    if (!valid.value || !port) {
      return;
    }
    port.publish({ kind: 'presence', role: 'renderer', overlayId: overlayId.value, at: Date.now() });
  }, 1000);
});

watch(overlayId, () => {
  state.value = emptyAlertQueue();
  if (frame) {
    cancelAnimationFrame(frame);
  }
  frame = 0;
  publish();
});

onScopeDispose(() => {
  if (beat) {
    clearInterval(beat);
  }
  if (frame) {
    cancelAnimationFrame(frame);
  }
  stop();
});

const visible = computed(() => (state.value.phase === 'visible' ? state.value.current : null));
</script>

<template>
  <div
    class="pointer-events-none fixed inset-0 bg-transparent"
    data-overlay-renderer
  >
    <div class="px-md pb-md flex h-full items-end">
      <Transition name="overlay-alert">
        <OverlayAlertCard
          v-if="visible"
          :key="visible.id"
          :alert="visible"
        />
      </Transition>
    </div>
  </div>
</template>

<style>
.overlay-alert-enter-active,
.overlay-alert-leave-active {
  transition:
    opacity 280ms ease,
    transform 280ms ease;
}

.overlay-alert-enter-from,
.overlay-alert-leave-to {
  opacity: 0;
  transform: translateY(2.4rem);
}

@media (prefers-reduced-motion: reduce) {
  .overlay-alert-enter-active,
  .overlay-alert-leave-active {
    transition-duration: 0ms;
  }
}
</style>
