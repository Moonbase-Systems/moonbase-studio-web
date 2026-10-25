<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { PAGE_TITLE } from '~/constants/page-title';

const head = useLocaleHead();
const route = useRoute();
const { t, te } = useI18n();
const title = computed(() => {
  if (route.meta.title && te(route.meta.title)) {
    return t(route.meta.title);
  }

  return PAGE_TITLE;
});

useHead({
  htmlAttrs: {
    lang: head.value.htmlAttrs?.lang,
    dir: head.value.htmlAttrs?.dir as 'ltr' | 'rtl' | 'auto' | undefined,
    class: 'theme-dark overscroll-none',
  },
  title,
  link: head.value.link,
  meta: [...head.value.meta, { name: 'apple-mobile-web-app-title', content: title.value }],
  bodyAttrs: {
    class: 'font-sans overflow-hidden',
  },
});
</script>

<template>
  <div class="bg-surface h-[100dvh] overflow-hidden">
    <slot />
  </div>
</template>
