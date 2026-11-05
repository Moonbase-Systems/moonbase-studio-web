<script setup lang="ts">
import { provideSSRWidth } from '@vueuse/core';

import StudioEntryCover from './components/studio-entry/StudioEntryCover.vue';
import { SSR_WIDTH } from './constants/ssr-width';
import { STUDIO_ENTRY_COVER_KEY } from './constants/studio-entry-cover';

provideSSRWidth(SSR_WIDTH);

const studioEntryCover = useState(STUDIO_ENTRY_COVER_KEY, () => false);
</script>

<template>
  <StudioEntryCover v-if="studioEntryCover" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
