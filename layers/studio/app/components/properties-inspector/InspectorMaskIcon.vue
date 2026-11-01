<script setup lang="ts">
const props = defineProps<{
  name: string;
}>();

const maskUrl = computed(() => `url("/inspector-icons/${props.name}.svg")`);
</script>

<template>
  <span
    class="inline-block size-full bg-current"
    :style="{
      maskImage: maskUrl,
      WebkitMaskImage: maskUrl,
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
      maskPosition: 'center',
      WebkitMaskPosition: 'center',
      maskSize: 'contain',
      WebkitMaskSize: 'contain',
    }"
    aria-hidden="true"
  />
</template>
