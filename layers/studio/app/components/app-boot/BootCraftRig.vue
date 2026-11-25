<script setup lang="ts">
import type { BootSwaySample } from '../../composables/boot-sway-motion';
import { useBootCraftSwayMotion } from '../../composables/useBootCraftSwayMotion';

const props = defineProps<{
  reduceMotion?: boolean;
  swayActive?: boolean;
  swayPaused?: boolean;
  neutralGateOpen?: boolean;
  exitSpin?: boolean;
  onSwayFrame?: (sample: BootSwaySample) => void;
}>();

const emit = defineEmits<{
  enterEnd: [];
  swayNeutral: [];
}>();

const enterDone = ref(false);
const motionRef = ref<HTMLElement | null>(null);

const swayRunning = computed(
  () => Boolean(props.swayActive) && enterDone.value && !props.swayPaused && !props.exitSpin && !props.reduceMotion,
);

const swayPausedRef = computed(() => Boolean(props.swayPaused));
const swayActiveRef = computed(() => swayRunning.value);
const reduceMotionRef = computed(() => Boolean(props.reduceMotion));

useBootCraftSwayMotion({
  element: motionRef,
  active: swayActiveRef,
  paused: swayPausedRef,
  reduceMotion: reduceMotionRef,
  onFrame: (sample) => {
    props.onSwayFrame?.(sample);
  },
  onNeutral: () => {
    if (props.neutralGateOpen) {
      emit('swayNeutral');
    }
  },
});

const motionClass = computed(() => {
  if (props.reduceMotion) {
    return 'boot-craft-motion-static';
  }
  if (props.exitSpin) {
    return 'boot-craft-spin-out';
  }
  if (enterDone.value) {
    return 'boot-craft-motion-idle';
  }
  return 'boot-craft-motion-pending';
});

const finishEnter = (): void => {
  if (enterDone.value) {
    return;
  }
  enterDone.value = true;
  emit('enterEnd');
};

const onEnterEnd = (event: AnimationEvent): void => {
  if (!event.animationName.includes('boot-craft-enter')) {
    return;
  }
  finishEnter();
};

watch(
  () => props.exitSpin,
  (spin) => {
    if (!spin || !motionRef.value) {
      return;
    }
    motionRef.value.style.transform = '';
  },
);

watch(
  () => props.reduceMotion,
  (reduce) => {
    if (reduce) {
      nextTick(() => finishEnter());
    }
  },
  { immediate: true },
);

defineExpose({
  motionElement: motionRef,
});
</script>

<template>
  <div
    class="boot-craft-enter"
    :class="{ 'boot-craft-enter-static': reduceMotion }"
    @animationend="onEnterEnd"
  >
    <div
      ref="motionRef"
      class="boot-craft-motion"
      :class="motionClass"
    >
      <div class="boot-craft-visual">
        <AppBootCraft />
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.boot-craft-enter {
  opacity: 0;
  animation: boot-craft-enter 1.35s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.boot-craft-enter-static {
  opacity: 1;
  animation: none;
}

.boot-craft-motion {
  transform: translate3d(0, -10px, 0) rotate(0deg);
  transform-origin: 50% 85%;
  will-change: transform;
  backface-visibility: hidden;
  contain: layout style;
}

.boot-craft-motion-pending,
.boot-craft-motion-idle {
  transform: translate3d(0, -10px, 0) rotate(0deg);
}

.boot-craft-motion-static {
  transform: none;
}

.boot-craft-spin-out {
  animation: boot-craft-spin-out ease-in forwards;
  animation-duration: 0.92s;
  transform-origin: 50% 55%;
  will-change: transform, opacity;
}

.boot-craft-visual {
  position: relative;
  width: 120px;
  height: 80px;
  transform: translateZ(0);
}

@keyframes boot-craft-enter {
  0% {
    opacity: 0;
    transform: translate3d(calc(-55vw - 4rem), 28px, 0) rotate(-10deg);
  }

  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(0deg);
  }
}

@keyframes boot-craft-spin-out {
  0% {
    transform: translate3d(0, -10px, 0) rotate(0deg) scale(1);
    opacity: 1;
  }

  100% {
    transform: translate3d(0, -10px, 0) rotate(720deg) scale(0);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .boot-craft-enter {
    opacity: 1;
    animation: none;
  }

  .boot-craft-motion {
    will-change: auto;
    contain: none;
  }
}
</style>
