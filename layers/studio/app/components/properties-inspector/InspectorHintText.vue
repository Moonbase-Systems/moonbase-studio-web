<script setup lang="ts">
defineProps<{
  hint: string;
  textClass?: string;
}>();

const visible = ref(false);
const x = ref(0);
const y = ref(0);
const tipRef = ref<HTMLElement | null>(null);

let timer: ReturnType<typeof setTimeout> | null = null;
let anchor = { x: 0, y: 0 };

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function place(clientX: number, clientY: number) {
  x.value = clientX + 14;
  y.value = clientY + 18;
}

function onEnter(event: MouseEvent) {
  clearTimer();
  anchor = { x: event.clientX, y: event.clientY };
  timer = setTimeout(() => {
    place(anchor.x, anchor.y);
    visible.value = true;
  }, 400);
}

function onMove(event: MouseEvent) {
  anchor = { x: event.clientX, y: event.clientY };
}

async function fitToViewport() {
  await nextTick();
  const tip = tipRef.value;
  if (!tip) {
    return;
  }
  const rect = tip.getBoundingClientRect();
  if (rect.right > window.innerWidth - 4) {
    x.value = Math.max(4, anchor.x - rect.width - 8);
  }
  if (rect.bottom > window.innerHeight - 4) {
    y.value = Math.max(4, anchor.y - rect.height - 8);
  }
}

function onLeave() {
  clearTimer();
  visible.value = false;
}

watch(visible, (shown) => {
  if (shown) {
    void fitToViewport();
  }
});

onScopeDispose(onLeave);
</script>

<template>
  <span
    :class="textClass"
    @mouseenter="onEnter"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <slot />
  </span>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="tipRef"
      class="font-inter text-body-sm pointer-events-none fixed z-[80] max-w-[280px] border border-white/15 bg-[color-mix(in_srgb,white_8%,#050004)] px-[8px] py-[6px] font-medium leading-[18px] text-white"
      :style="{ left: `${x}px`, top: `${y}px` }"
    >
      {{ hint }}
    </div>
  </Teleport>
</template>
