<script setup lang="ts">
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from 'reka-ui';

withDefaults(
  defineProps<{
    title: string;
    /** Mono label above the title (context of the question). */
    label?: string;
    description?: string;
    /** Visually hidden description when the dialog body is a list. */
    srDescription?: string;
    tone?: 'accent' | 'error';
  }>(),
  {
    label: undefined,
    description: undefined,
    srDescription: undefined,
    tone: 'accent',
  },
);
</script>

<template>
  <AlertDialogPortal>
    <AlertDialogOverlay class="bg-surface fixed inset-0 z-50" />
    <AlertDialogContent
      class="border-line bg-surface-container p-xx-lg gap-x-sm fixed left-1/2 top-1/2 z-50 flex w-[min(40rem,calc(100vw-3.2rem))] -translate-x-1/2 -translate-y-1/2 flex-col border outline-none"
    >
      <BaseFrameBrackets
        corners="all"
        :tone="tone"
      />
      <span
        v-if="label"
        class="text-label font-mono uppercase"
        :class="tone === 'error' ? 'text-error' : 'text-on-surface-dim'"
      >
        {{ label }}
      </span>
      <AlertDialogTitle class="text-title text-on-surface font-light">
        {{ title }}
      </AlertDialogTitle>
      <AlertDialogDescription
        v-if="description"
        class="text-body-md text-on-surface-dim"
      >
        {{ description }}
      </AlertDialogDescription>
      <AlertDialogDescription
        v-else-if="srDescription"
        class="sr-only"
      >
        {{ srDescription }}
      </AlertDialogDescription>

      <slot />

      <div
        v-if="$slots.actions"
        class="border-line mt-x-sm gap-xx-lg pt-md flex items-center border-t"
      >
        <slot name="actions" />
      </div>
    </AlertDialogContent>
  </AlertDialogPortal>
</template>
