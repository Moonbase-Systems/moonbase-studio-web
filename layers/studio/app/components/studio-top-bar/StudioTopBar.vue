<script setup lang="ts">
import { AlertDialogAction, AlertDialogCancel, AlertDialogRoot, AlertDialogTrigger } from 'reka-ui';

import StudioDialog from '../studio-dialog/StudioDialog.vue';
import ProjectDocumentActions from './ProjectDocumentActions.vue';

const { t } = useI18n();
const localePath = useLocalePath();

const open = ref(false);

async function leaveToHome() {
  await navigateTo(localePath('/'));
}
</script>

<template>
  <header class="border-line bg-surface px-md gap-xx-lg h-bar flex shrink-0 items-center border-b">
    <AlertDialogRoot v-model:open="open">
      <AlertDialogTrigger as-child>
        <button
          type="button"
          class="text-brand-logo text-accent hover:text-accent-dim focus-visible:ring-accent focus-visible:ring-offset-surface font-brand outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          MoonBase
        </button>
      </AlertDialogTrigger>

      <StudioDialog
        :title="t('studio.exitConfirm.title')"
        :description="t('studio.exitConfirm.message')"
      >
        <template #actions>
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
        </template>
      </StudioDialog>
    </AlertDialogRoot>
    <ProjectDocumentActions />
  </header>
</template>
