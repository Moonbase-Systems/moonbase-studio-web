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
} from 'reka-ui';

import { useProjectDocument } from '../../composables/useProjectDocument';
import { useStudioSessionStore } from '../../store/studio-session.store';

const { t } = useI18n();
const store = useStudioSessionStore();
const {
  statusMessage,
  catalog,
  catalogOpen,
  confirmOpen,
  requestNewProject,
  requestOpen,
  confirmDiscard,
  saveProject,
  openProject,
} = useProjectDocument();
</script>

<template>
  <div class="gap-sm ml-auto flex min-w-0 items-center">
    <p
      v-if="store.project"
      class="text-body-sm font-roboto text-on-surface truncate"
    >
      {{ store.project.name }}
      <span
        v-if="store.isDirty"
        class="text-accent"
      >
        •
      </span>
    </p>

    <BaseTextButton
      :text="t('studio.document.new')"
      @click="requestNewProject"
    />
    <BaseTextButton
      :text="t('studio.document.open')"
      @click="requestOpen"
    />
    <BaseTextButton
      :text="t('studio.document.save')"
      :disabled="!store.project"
      @click="saveProject"
    />

    <span
      v-if="statusMessage"
      class="text-body-sm font-roboto text-on-surface-dim truncate"
      role="status"
    >
      {{ statusMessage }}
    </span>

    <AlertDialogRoot v-model:open="confirmOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay class="bg-surface/80 fixed inset-0 z-50" />
        <AlertDialogContent
          class="border-accent bg-surface-container p-md fixed left-1/2 top-1/2 z-50 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-sm border shadow-lg outline-none"
        >
          <AlertDialogTitle class="text-heading-md text-accent text-center font-display">
            {{ t('studio.document.discardTitle') }}
          </AlertDialogTitle>
          <AlertDialogDescription class="text-body-md text-on-surface mt-sm text-center">
            {{ t('studio.document.discardMessage') }}
          </AlertDialogDescription>
          <div class="mt-md gap-md flex items-center justify-center">
            <AlertDialogAction as-child>
              <BaseTextButton
                :text="t('studio.document.discardConfirm')"
                class="text-accent"
                @click="confirmDiscard"
              />
            </AlertDialogAction>
            <AlertDialogCancel as-child>
              <BaseTextButton :text="t('studio.document.cancel')" />
            </AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>

    <AlertDialogRoot v-model:open="catalogOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay class="bg-surface/80 fixed inset-0 z-50" />
        <AlertDialogContent
          class="border-accent bg-surface-container p-md fixed left-1/2 top-1/2 z-50 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-sm border shadow-lg outline-none"
        >
          <AlertDialogTitle class="text-heading-md text-accent text-center font-display">
            {{ t('studio.document.openTitle') }}
          </AlertDialogTitle>
          <AlertDialogDescription class="sr-only">
            {{ t('studio.document.openTitle') }}
          </AlertDialogDescription>

          <p
            v-if="catalog.length === 0"
            class="text-body-md text-on-surface mt-sm text-center"
          >
            {{ t('studio.document.emptyCatalog') }}
          </p>
          <ul
            v-else
            class="mt-sm max-h-64 space-y-1 overflow-y-auto"
          >
            <li
              v-for="project in catalog"
              :key="project.id"
            >
              <button
                type="button"
                class="text-body-md font-roboto text-on-surface hover:bg-surface-container-high rounded-x-sm px-sm py-xx-sm w-full text-left"
                @click="openProject(project.id)"
              >
                {{ project.name }}
              </button>
            </li>
          </ul>

          <div class="mt-md flex justify-center">
            <AlertDialogCancel as-child>
              <BaseTextButton :text="t('studio.document.cancel')" />
            </AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </div>
</template>
