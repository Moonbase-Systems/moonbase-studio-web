<script setup lang="ts">
import { AlertDialogAction, AlertDialogCancel, AlertDialogRoot } from 'reka-ui';

import { useDocumentShortcuts } from '../../composables/useDocumentShortcuts';
import { useProjectDocument } from '../../composables/useProjectDocument';
import { useStudioSessionStore } from '../../store/studio-session.store';
import StudioDialog from '../studio-dialog/StudioDialog.vue';
import StudioOptionsDialog from './StudioOptionsDialog.vue';

const { t } = useI18n();
const store = useStudioSessionStore();
const {
  statusMessage,
  catalog,
  confirmOpen,
  refreshCatalog,
  requestSwitchProject,
  confirmDiscard,
  cancelDiscard,
  saveProject,
  saveProjectAs,
  exportProjectFile,
  importProjectFile,
} = useProjectDocument();

const menuOpen = ref(false);
const optionsOpen = ref(false);
const renaming = ref(false);
const nameDraft = ref('');
const nameError = ref<string | null>(null);
const nameInputRef = ref<HTMLInputElement | null>(null);
const menuRootRef = ref<HTMLElement | null>(null);
const importInputRef = ref<HTMLInputElement | null>(null);

const menuProjects = computed(() => {
  const current = store.project;
  if (!current) {
    return catalog.value;
  }
  if (catalog.value.some((project) => project.id === current.id)) {
    return catalog.value;
  }
  return [
    { id: current.id, name: current.name, type: current.type, updatedAt: current.metadata.updatedAt },
    ...catalog.value,
  ];
});

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
  menuOpen.value = false;
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

async function openMenu() {
  menuOpen.value = true;
  await refreshCatalog();
}

async function toggleMenu() {
  if (menuOpen.value) {
    menuOpen.value = false;
    return;
  }
  await openMenu();
}

function chooseProject(projectId: string) {
  menuOpen.value = false;
  requestSwitchProject(projectId);
}

async function onSave() {
  menuOpen.value = false;
  await saveProject();
}

async function onSaveAs() {
  menuOpen.value = false;
  await saveProjectAs();
}

async function onExport() {
  await exportProjectFile();
  menuOpen.value = false;
}

function onImport() {
  menuOpen.value = false;
  importInputRef.value?.click();
}

async function onImportFile(event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const file = input.files?.[0];
  input.value = '';
  if (!file) {
    return;
  }
  await importProjectFile(file);
}

function onOptions() {
  menuOpen.value = false;
  optionsOpen.value = true;
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!menuOpen.value) {
    return;
  }
  const root = menuRootRef.value;
  if (root && event.target instanceof Node && root.contains(event.target)) {
    return;
  }
  menuOpen.value = false;
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && menuOpen.value && !renaming.value) {
    menuOpen.value = false;
  }
}

useDocumentShortcuts({ saveProject, openMenu, menuOpen });

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  window.addEventListener('keydown', onWindowKeydown);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  window.removeEventListener('keydown', onWindowKeydown);
});

const menuItemClass =
  'text-body-sm hover:bg-surface-container-high focus-visible:ring-accent px-xxx-sm h-row w-full truncate text-left font-sans outline-none focus-visible:ring-2 focus-visible:ring-inset';
</script>

<template>
  <div class="gap-xx-lg flex h-full min-w-0 flex-1 items-center">
    <div
      v-if="store.project"
      ref="menuRootRef"
      class="relative min-w-0 max-w-[22.4rem]"
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
        class="text-body-sm text-on-surface hover:text-accent focus-visible:ring-accent focus-visible:ring-offset-surface gap-xxx-sm h-row flex max-w-full items-center text-left font-sans outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        :aria-expanded="menuOpen"
        aria-haspopup="menu"
        :aria-label="t('studio.document.menu')"
        @click="toggleMenu"
      >
        <span
          v-if="store.isDirty"
          class="bg-accent size-xxx-sm shrink-0 rounded-full"
          aria-hidden="true"
        />
        <span class="min-w-0 truncate">{{ store.project.name }}</span>
        <IconChevronRight
          v-if="!menuOpen"
          class="text-on-surface-dim size-4 shrink-0"
        />
        <IconChevronDown
          v-else
          class="text-on-surface-dim size-4 shrink-0"
        />
      </button>
      <div
        v-if="menuOpen"
        class="border-line bg-surface-container p-tiny mt-tiny absolute left-0 top-full z-40 w-[28rem] border"
        role="menu"
      >
        <span class="text-label text-on-surface-dim px-xxx-sm py-tiny block font-mono uppercase">
          {{ t('studio.document.projects') }}
        </span>
        <p
          v-if="menuProjects.length === 0"
          class="text-body-sm text-on-surface-dim px-xxx-sm h-row flex items-center font-sans"
        >
          {{ t('studio.document.emptyCatalog') }}
        </p>
        <button
          v-for="project in menuProjects"
          :key="project.id"
          type="button"
          role="menuitem"
          :class="[menuItemClass, project.id === store.project?.id ? 'text-accent' : 'text-on-surface']"
          @click="chooseProject(project.id)"
        >
          {{ project.name }}
        </button>
        <div class="border-line mt-tiny pt-tiny flex flex-col border-t">
          <button
            type="button"
            role="menuitem"
            :class="[menuItemClass, 'text-on-surface']"
            :disabled="!store.project"
            @click="onSave"
          >
            {{ t('studio.document.save') }}
          </button>
          <button
            type="button"
            role="menuitem"
            :class="[menuItemClass, 'text-on-surface']"
            :disabled="!store.project"
            @click="onSaveAs"
          >
            {{ t('studio.document.saveAs') }}
          </button>
          <button
            type="button"
            role="menuitem"
            :class="[menuItemClass, 'text-on-surface']"
            :disabled="!store.project"
            @click="onExport"
          >
            {{ t('studio.document.exportFile') }}
          </button>
          <button
            type="button"
            role="menuitem"
            :class="[menuItemClass, 'text-on-surface']"
            @click="onImport"
          >
            {{ t('studio.document.importFile') }}
          </button>
          <button
            type="button"
            role="menuitem"
            :class="[menuItemClass, 'text-on-surface']"
            @click="onOptions"
          >
            {{ t('studio.document.options') }}
          </button>
          <button
            type="button"
            role="menuitem"
            :class="[menuItemClass, 'text-on-surface']"
            @click="startRename"
          >
            {{ t('studio.document.rename') }}
          </button>
        </div>
      </div>
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

    <div class="min-w-0 flex-1" />

    <div class="gap-md flex h-full shrink-0 items-center">
      <slot name="trailing" />
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
            <BaseTextButton
              :text="t('studio.document.cancel')"
              @click="cancelDiscard"
            />
          </AlertDialogCancel>
        </template>
      </StudioDialog>
    </AlertDialogRoot>

    <StudioOptionsDialog v-model="optionsOpen" />
    <input
      ref="importInputRef"
      type="file"
      accept=".moonbase,.json,application/json"
      class="sr-only"
      :aria-label="t('studio.document.importFile')"
      @change="onImportFile"
    />
  </div>
</template>
