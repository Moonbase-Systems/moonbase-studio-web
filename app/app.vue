<script setup lang="ts">
import { provideSSRWidth } from '@vueuse/core';

import { SSR_WIDTH } from './constants/ssr-width';

provideSSRWidth(SSR_WIDTH);
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
