<script setup lang="ts">
const { t } = useI18n();

const prefersReducedMotion = usePreferredReducedMotion();
const reduceMotion = computed(() => prefersReducedMotion.value === 'reduce');
</script>

<template>
  <div
    class="entry-cover bg-surface fixed inset-0 z-[80] flex items-center justify-center"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <div class="entry-cover-stage">
      <BootCraftRig :reduce-motion="reduceMotion" />
      <p
        class="entry-cover-label border-line bg-surface-container px-xx-lg py-xxx-sm text-body-sm text-on-surface border font-sans"
        :class="{ 'entry-cover-label-static': reduceMotion }"
      >
        {{ t('studio.boot.opening') }}
      </p>
    </div>

    <div
      class="entry-cover-progress bottom-xxx-huge absolute left-1/2 w-[min(64rem,calc(100%-3.2rem))] -translate-x-1/2"
      :class="{ 'entry-cover-label-static': reduceMotion }"
    >
      <AppBootProgress stage="opening" />
    </div>
  </div>
</template>

<style scoped>
.entry-cover-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(100%, 48rem);
}

/* Same place as the boot screen label, so the hand-off does not jump. */
.entry-cover-label {
  margin: 12rem 0 0;
  animation: entry-label-fade-in 0.65s ease-out both;
  animation-delay: 1.35s;
}

.entry-cover-progress {
  animation: entry-progress-fade-in 0.6s ease-out 0.9s both;
}

@keyframes entry-progress-fade-in {
  0% {
    opacity: 0;
    transform: translate(-50%, 0.8rem);
  }

  100% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

.entry-cover-label-static {
  animation: none;
  opacity: 1;
}

@keyframes entry-label-fade-in {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .entry-cover-label,
  .entry-cover-progress {
    animation: none;
    opacity: 1;
  }
}
</style>
