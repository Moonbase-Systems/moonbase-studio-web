<script setup lang="ts">
import { AlertDialogAction, AlertDialogCancel, AlertDialogRoot, AlertDialogTrigger } from 'reka-ui';

import StudioDialog from '../studio-dialog/StudioDialog.vue';
import ProjectDocumentActions from './ProjectDocumentActions.vue';

const { t } = useI18n();
const localePath = useLocalePath();

const open = ref(false);
/** Bridge is not wired yet — keep transport actions disabled. */
const bridgeOnline = ref(false);

const transportLabels = computed(() => ({
  group: t('studio.transport.group'),
  status: t('studio.transport.statusIdle'),
  pause: t('studio.transport.pause'),
  resume: t('studio.transport.resume'),
  stop: t('studio.transport.stop'),
  stream: t('studio.transport.stream'),
  record: t('studio.transport.record'),
}));

async function leaveToHome() {
  await navigateTo(localePath('/'));
}
</script>

<template>
  <header class="border-line bg-surface px-md h-bar gap-xx-lg flex shrink-0 items-center border-b">
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

    <ProjectDocumentActions>
      <template #trailing>
        <BaseTransportControl
          state="idle"
          time="00:00:00"
          :stream-disabled="!bridgeOnline"
          :labels="transportLabels"
        />
        <span
          class="bg-line h-xx-lg w-px shrink-0"
          aria-hidden="true"
        />
        <div class="gap-md flex shrink-0 items-center">
          <BaseStatusBadge
            :state="bridgeOnline ? 'ok' : 'offline'"
            :label="t('studio.transport.bridge')"
          />
          <BaseStatusBadge
            state="offline"
            :label="t('studio.transport.controller')"
          />
        </div>
        <span
          class="bg-line h-xx-lg w-px shrink-0"
          aria-hidden="true"
        />
      </template>
    </ProjectDocumentActions>
  </header>
</template>
