<script setup lang="ts">
import { useTreeLine } from '#layers/moonbase-core/app/utils/tree-line';
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

const { childActive } = useTreeLine(() => props.selected);
const lineActive = computed(() => props.selected || childActive.value);

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

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  if (target.closest('[data-scene-view], [data-scene-context-menu]')) {
    return;
  }
  emit('deselect');
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
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
  <div data-scene-view>
    <BaseCollapsible
      :open="open"
      @update:open="emit('update:open', $event)"
    >
      <template #trigger>
        <div class="gap-x-sm min-h-md flex items-center justify-between">
          <input
            v-if="renaming"
            ref="inputRef"
            :value="renameDraft"
            class="text-body-md text-on-surface min-w-0 flex-1 bg-transparent text-left font-medium outline-none"
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
                'text-body-md duration-short min-w-0 flex-1 truncate text-left font-medium transition-colors',
                props.selected ? 'text-accent' : 'text-on-surface',
                'hover:text-accent focus-visible:ring-accent focus-visible:ring-offset-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              )
            "
            @click="onSelect"
          >
            {{ name }}
          </button>

          <div class="gap-tiny flex shrink-0 items-center">
            <BaseIconButton
              :label="t('studio.scene.delete')"
              @click="emit('delete')"
            >
              <IconMinus />
            </BaseIconButton>
            <BaseIconButton
              :label="expandCollapseLabel"
              @click="onToggleOpen"
            >
              <IconChevronRight v-if="!open" />
              <IconChevronDown v-else />
            </BaseIconButton>
          </div>
        </div>
        <p
          v-if="renaming && renameError"
          class="text-body-sm text-on-surface-dim"
        >
          {{ renameError }}
        </p>
      </template>

      <BaseRevealList
        :active="lineActive"
        dense
      >
        <slot />

        <div class="pt-tiny flex justify-end">
          <slot name="add" />
        </div>
      </BaseRevealList>
    </BaseCollapsible>
  </div>
</template>
