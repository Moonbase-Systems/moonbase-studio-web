<script setup lang="ts">
const props = defineProps<{
  label: string;
}>();

const host = ref<HTMLElement | null>(null);
const text = ref<HTMLElement | null>(null);
const overflows = ref(false);
const hovering = ref(false);

const duration = computed(() => `${Math.max(8, Math.ceil(props.label.length / 5))}s`);

function measure() {
  const hostElement = host.value;
  const textElement = text.value;
  if (!hostElement || !textElement) {
    return;
  }
  overflows.value = textElement.scrollWidth > hostElement.clientWidth + 1;
}

function onEnter() {
  hovering.value = true;
}

function onLeave() {
  hovering.value = false;
}

let option: HTMLElement | null = null;

onMounted(() => {
  nextTick(() => {
    measure();
    option = host.value?.closest('button') ?? null;
    option?.addEventListener('mouseenter', onEnter);
    option?.addEventListener('mouseleave', onLeave);
  });
});

onBeforeUnmount(() => {
  option?.removeEventListener('mouseenter', onEnter);
  option?.removeEventListener('mouseleave', onLeave);
});

watch(
  () => props.label,
  () => nextTick(measure),
);
</script>

<template>
  <span
    ref="host"
    class="block min-w-0 flex-1 overflow-hidden"
  >
    <span
      class="marquee-track flex w-max items-center"
      :class="overflows && hovering && 'is-running'"
      :style="{ '--marquee-duration': duration }"
    >
      <span
        ref="text"
        class="marquee-copy"
        :class="overflows && 'marquee-gap'"
      >
        {{ label }}
      </span>
      <span
        v-if="overflows"
        aria-hidden="true"
        class="marquee-copy marquee-gap"
      >
        {{ label }}
      </span>
    </span>
  </span>
</template>

<style scoped>
.marquee-copy {
  flex-shrink: 0;
  white-space: nowrap;
  padding-inline: 0.4rem;
}

.marquee-gap {
  margin-right: 2.4rem;
}

.is-running {
  animation: inspector-marquee var(--marquee-duration, 8s) linear infinite;
}

@keyframes inspector-marquee {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(-50%);
  }
}
</style>
