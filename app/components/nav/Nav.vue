<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();

const links = [
  { to: '/', labelKey: 'nav.home' },
  { to: '/news', labelKey: 'nav.news' },
  { to: '/about', labelKey: 'nav.about' },
  { to: '/faq', labelKey: 'nav.faq' },
  { to: '/contact', labelKey: 'nav.contact' },
] as const;

function isActive(path: string) {
  if (path === '/') {
    return route.path === '/';
  }

  return route.path === path || route.path.startsWith(`${path}/`);
}

function goTo(path: (typeof links)[number]['to']) {
  return navigateTo(localePath(path));
}
</script>

<template>
  <header class="px-x-lg py-md flex items-center justify-between">
    <NuxtLink
      :to="localePath('/')"
      class="text-accent font-display text-7xl"
    >
      {{ t('nav.logo') }}
    </NuxtLink>

    <nav class="gap-x-lg flex items-center">
      <BaseTextButton
        v-for="link in links"
        :key="link.to"
        :text="t(link.labelKey)"
        :active="isActive(link.to)"
        class="font-sans"
        @click="goTo(link.to)"
      />
      <BaseTextButton
        :text="t('nav.app')"
        :active="isActive('/app')"
        class="font-display text-5xl"
        @click="navigateTo('/app')"
      />
    </nav>
  </header>
</template>
