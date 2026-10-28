<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string;
    open?: boolean;
  }>(),
  { open: true },
);

const openModel = defineModel<boolean>('open', { default: true });
</script>

<template>
  <section class="border-on-surface-dim/20 py-sm border-b last:border-b-0">
    <button
      type="button"
      class="text-body-sm font-roboto text-on-surface py-xx-sm flex w-full items-center justify-between text-left font-medium"
      @click="openModel = !openModel"
    >
      {{ props.title }}
      <IconChevronDown
        class="size-4 shrink-0 transition-transform"
        :class="openModel ? '' : '-rotate-90'"
      />
    </button>
    <div
      v-show="openModel"
      class="gap-sm pt-sm flex flex-col"
    >
      <slot />
    </div>
  </section>
</template>
