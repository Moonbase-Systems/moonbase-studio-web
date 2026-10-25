<script setup lang="ts">
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
  AlertDialogTrigger,
} from 'reka-ui';

const { t } = useI18n();
const localePath = useLocalePath();

const open = ref(false);

async function leaveToHome() {
  await navigateTo(localePath('/'));
}
</script>

<template>
  <header class="border-accent px-md flex h-[3.6rem] shrink-0 items-center border-b border-solid">
    <AlertDialogRoot v-model:open="open">
      <AlertDialogTrigger as-child>
        <button
          type="button"
          class="text-heading-lg text-accent hover:text-accent-dim focus-visible:ring-accent focus-visible:ring-offset-surface rounded-x-sm font-display outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          MoonBase
        </button>
      </AlertDialogTrigger>

      <AlertDialogPortal>
        <AlertDialogOverlay class="bg-surface/80 fixed inset-0 z-50" />
        <AlertDialogContent
          class="border-accent bg-surface-container p-md fixed left-1/2 top-1/2 z-50 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-sm border shadow-lg outline-none"
        >
          <AlertDialogTitle class="text-heading-md text-accent text-center font-display">
            {{ t('studio.exitConfirm.title') }}
          </AlertDialogTitle>
          <AlertDialogDescription class="text-body-md text-on-surface mt-sm text-center">
            {{ t('studio.exitConfirm.message') }}
          </AlertDialogDescription>

          <div class="mt-md gap-md flex items-center justify-center">
            <AlertDialogAction as-child>
              <BaseTextButton
                :text="t('studio.exitConfirm.yes')"
                class="text-accent"
                @click="leaveToHome"
              />
            </AlertDialogAction>
            <AlertDialogCancel as-child>
              <BaseTextButton :text="t('studio.exitConfirm.no')" />
            </AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </header>
</template>
