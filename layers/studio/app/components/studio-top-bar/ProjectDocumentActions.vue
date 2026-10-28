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

const renaming = ref(false);
const nameDraft = ref('');
const nameError = ref<string | null>(null);
const nameInputRef = ref<HTMLInputElement | null>(null);

watch(
  () => store.project?.name,
  (name) => {
    if (!renaming.value && name) {
      nameDraft.value = name;
    }
  },
  { immediate: true },
);

function startRename() {
  if (!store.project || renaming.value) {
    return;
  }
  nameDraft.value = store.project.name;
  nameError.value = null;
  renaming.value = true;
  void nextTick(() => {
    nameInputRef.value?.focus();
    nameInputRef.value?.select();
  });
}

function cancelRename() {
  renaming.value = false;
  nameError.value = null;
  nameDraft.value = store.project?.name ?? '';
}

function commitRename() {
  if (!renaming.value || !store.project) {
    return;
  }
  const trimmed = nameDraft.value.trim();
  if (trimmed === store.project.name) {
    cancelRename();
    return;
  }
  const result = store.updateProject({ name: trimmed });
  if (!result.ok) {
    nameError.value = t('studio.document.invalidProjectName');
    void nextTick(() => {
      nameInputRef.value?.focus();
    });
    return;
  }
  nameError.value = null;
  renaming.value = false;
}

function onRenameKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitRename();
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelRename();
  }
}
</script>

<template>
  <div class="gap-sm ml-auto flex min-w-0 items-center">
    <div
      v-if="store.project"
      class="min-w-0 max-w-[14rem]"
    >
      <input
        v-if="renaming"
        ref="nameInputRef"
        v-model="nameDraft"
        type="text"
        maxlength="128"
        class="text-body-sm font-roboto text-on-surface border-on-surface-dim/40 bg-surface-container rounded-x-sm px-xx-sm focus:border-accent h-7 w-full min-w-0 border outline-none"
        :aria-label="t('studio.document.renameProject')"
        :aria-invalid="nameError ? true : undefined"
        @keydown="onRenameKeydown"
        @blur="commitRename"
      />
      <button
        v-else
        type="button"
        class="text-body-sm font-roboto text-on-surface hover:text-accent focus-visible:ring-accent rounded-x-sm max-w-full truncate text-left outline-none focus-visible:ring-2"
        :title="t('studio.document.renameProject')"
        @click="startRename"
      >
        {{ store.project.name }}
        <span
          v-if="store.isDirty"
          class="text-accent"
        >
          •
        </span>
      </button>
      <p
        v-if="nameError"
        class="text-body-x-sm text-error mt-x-tiny truncate"
      >
        {{ nameError }}
      </p>
    </div>

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
