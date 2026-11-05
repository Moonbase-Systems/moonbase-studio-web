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
        class="entry-cover-label text-body-sm font-roboto"
        :class="{ 'entry-cover-label-static': reduceMotion }"
      >
        {{ t('studio.boot.opening') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.entry-cover-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(100%, 20rem);
}

.entry-cover-label {
  margin: 0.75rem 0 0;
  color: rgb(var(--color-on-surface) / 45%);
  animation: entry-label-fade-in 0.65s ease-out both;
  animation-delay: 1.35s;
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
  .entry-cover-label {
    animation: none;
    opacity: 1;
  }
}
</style>
