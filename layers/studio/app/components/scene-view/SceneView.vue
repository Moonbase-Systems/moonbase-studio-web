<script setup lang="ts">
import { cn } from '~/utils/index';

import { useShortcutStore } from '../../store/shortcut.store';
import type { SceneViewProps } from '.';

const shortcuts = useShortcutStore();

const props = withDefaults(defineProps<SceneViewProps>(), {
  open: false,
  selected: false,
  renaming: false,
  renameDraft: '',
  renameError: null,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [];
  delete: [];
  deselect: [];
  'update:renameDraft': [value: string];
  renameCommit: [];
  renameCancel: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
let ignoreBlur = false;
let focusUntil = 0;
let focusTimer = 0;

function focusRenameInput() {
  const input = inputRef.value;
  if (!input) {
    return;
  }
  input.focus();
  input.select();
}

function holdRenameFocus() {
  window.clearInterval(focusTimer);
  focusUntil = Date.now() + 250;
  void nextTick(() => {
    focusRenameInput();
  });
  focusTimer = window.setInterval(() => {
    if (!props.renaming || Date.now() > focusUntil) {
      window.clearInterval(focusTimer);
      return;
    }
    if (document.activeElement !== inputRef.value) {
      focusRenameInput();
    }
  }, 16);
}

watch(
  () => props.renaming,
  (renaming) => {
    if (!renaming) {
      window.clearInterval(focusTimer);
      return;
    }
    holdRenameFocus();
  },
  { flush: 'post' },
);

onUnmounted(() => {
  window.clearInterval(focusTimer);
});

const { t } = useI18n();

function onToggleOpen(event: MouseEvent) {
  event.stopPropagation();
  emit('update:open', !props.open);
}

function onSelect() {
  emit('select');
}

function onRenameCommit() {
  if (ignoreBlur) {
    ignoreBlur = false;
    return;
  }
  if (Date.now() < focusUntil && document.activeElement !== inputRef.value) {
    return;
  }
  emit('renameCommit');
}

function onRenameCancel() {
  ignoreBlur = true;
  emit('renameCancel');
}

function onRenameKeyDown(event: KeyboardEvent) {
  if (shortcuts.matchesKey(event, 'rename.commit')) {
    event.preventDefault();
    event.stopPropagation();
    onRenameCommit();
    return;
  }
  if (shortcuts.matchesKey(event, 'rename.cancel')) {
    event.preventDefault();
    event.stopPropagation();
    onRenameCancel();
  }
}

const expandCollapseLabel = computed(() => (props.open ? t('studio.scene.collapse') : t('studio.scene.expand')));
</script>

<template>
  <div
    class="mt-xxx-sm"
    data-scene-view
  >
    <BaseCollapsible
      :open="open"
      @update:open="emit('update:open', $event)"
    >
      <template #trigger>
        <div class="gap-xxx-sm pr-tiny min-h-row flex items-center justify-between">
          <input
            v-if="renaming"
            ref="inputRef"
            :value="renameDraft"
            class="text-label text-on-surface border-accent tracking-label min-w-0 flex-1 border-b bg-transparent text-left font-mono uppercase outline-none"
            @input="emit('update:renameDraft', ($event.target as HTMLInputElement).value)"
            @keydown="onRenameKeyDown"
            @blur="onRenameCommit"
            @click.stop
            @keydown.stop
          />
          <button
            v-else
            type="button"
            :class="
              cn(
                'text-label tracking-label duration-short min-w-0 flex-1 truncate text-left font-mono uppercase transition-colors',
                props.selected ? 'text-accent' : 'text-on-surface-dim',
                'hover:text-on-surface focus-visible:ring-accent focus-visible:ring-offset-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              )
            "
            @click="onSelect"
          >
            {{ name }}
          </button>

          <div class="flex shrink-0 items-center gap-0">
            <BaseIconButton
              :label="t('studio.scene.delete')"
              class="inline-flex size-6 items-center justify-center p-0"
              @click="emit('delete')"
            >
              <IconMinus class="size-4" />
            </BaseIconButton>
            <BaseIconButton
              :label="expandCollapseLabel"
              class="inline-flex size-6 items-center justify-center p-0"
              @click="onToggleOpen"
            >
              <IconChevronRight
                v-if="!open"
                class="size-4"
              />
              <IconChevronDown
                v-else
                class="size-4"
              />
            </BaseIconButton>
          </div>
        </div>
        <p
          v-if="renaming && renameError"
          class="text-body-x-sm text-error"
        >
          {{ renameError }}
        </p>
      </template>

      <div class="flex flex-col gap-0">
        <slot />

        <div class="pt-tiny flex justify-end">
          <slot name="add" />
        </div>
      </div>
    </BaseCollapsible>
  </div>
</template>
