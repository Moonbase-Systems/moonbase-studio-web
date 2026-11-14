<script setup lang="ts">
import { AlertDialogAction, AlertDialogCancel, AlertDialogRoot } from 'reka-ui';

import { useProjectDocument } from '../../composables/useProjectDocument';
import { useStudioSessionStore } from '../../store/studio-session.store';
import StudioDialog from '../studio-dialog/StudioDialog.vue';

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
  <div class="gap-xx-lg flex min-w-0 flex-1 items-center">
    <div
      v-if="store.project"
      class="min-w-0 max-w-[24rem]"
    >
      <input
        v-if="renaming"
        ref="nameInputRef"
        v-model="nameDraft"
        type="text"
        maxlength="128"
        class="text-body-sm text-on-surface border-on-surface-dim px-xxx-sm focus:border-accent h-row w-full min-w-0 border bg-transparent font-sans outline-none"
        :aria-label="t('studio.document.renameProject')"
        :aria-invalid="nameError ? true : undefined"
        @keydown="onRenameKeydown"
        @blur="commitRename"
      />
      <button
        v-else
        type="button"
        class="text-body-sm text-on-surface hover:text-accent focus-visible:ring-accent focus-visible:ring-offset-surface max-w-full truncate text-left font-sans outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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

    <span
      v-if="statusMessage"
      class="text-label text-on-surface-dim truncate font-mono uppercase"
      role="status"
    >
      {{ statusMessage }}
    </span>

    <div class="gap-xx-lg ml-auto flex shrink-0 items-center">
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
    </div>

    <AlertDialogRoot v-model:open="confirmOpen">
      <StudioDialog
        tone="error"
        :title="t('studio.document.discardTitle')"
        :description="t('studio.document.discardMessage')"
      >
        <template #actions>
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
        </template>
      </StudioDialog>
    </AlertDialogRoot>

    <AlertDialogRoot v-model:open="catalogOpen">
      <StudioDialog
        :title="t('studio.document.openTitle')"
        :sr-description="t('studio.document.openTitle')"
      >
        <p
          v-if="catalog.length === 0"
          class="text-body-md text-on-surface-dim"
        >
          {{ t('studio.document.emptyCatalog') }}
        </p>
        <ul
          v-else
          class="border-line max-h-[32rem] overflow-y-auto border-t"
        >
          <li
            v-for="project in catalog"
            :key="project.id"
            class="border-line border-b"
          >
            <button
              type="button"
              class="text-body-md text-on-surface hover:bg-surface-container-high hover:text-accent focus-visible:ring-accent px-xxx-sm h-control w-full text-left font-sans outline-none focus-visible:ring-2 focus-visible:ring-inset"
              @click="openProject(project.id)"
            >
              {{ project.name }}
            </button>
          </li>
        </ul>

        <template #actions>
          <AlertDialogCancel as-child>
            <BaseTextButton :text="t('studio.document.cancel')" />
          </AlertDialogCancel>
        </template>
      </StudioDialog>
    </AlertDialogRoot>
  </div>
</template>
