<script setup lang="ts">
import { useTreeLine } from '#layers/moonbase-core/app/utils/tree-line';
import { cn } from '~/utils/index';

import type { SceneDropZone } from '../../composables/useSceneListInteraction';
import { useShortcutStore } from '../../store/shortcut.store';
import type { SceneListRowIconKind } from './scene-element-type-icons';
import SceneElementTypeIcon from './SceneElementTypeIcon.vue';

const shortcuts = useShortcutStore();

const props = withDefaults(
  defineProps<{
    label: string;
    selected?: boolean;
    zone?: SceneDropZone | null;
    editing?: boolean;
    draft?: string;
    error?: string | null;
    expandable?: boolean;
    open?: boolean;
    toggleLabel?: string;
    deleteLabel: string;
    iconKind?: SceneListRowIconKind;
    /** Unique member types for a group row (shown instead of a folder icon). */
    iconKinds?: SceneListRowIconKind[];
  }>(),
  {
    selected: false,
    iconKind: undefined,
    iconKinds: () => [],
    zone: null,
    editing: false,
    draft: '',
    error: null,
    expandable: false,
    open: false,
    toggleLabel: '',
  },
);

const emit = defineEmits<{
  select: [event: MouseEvent];
  delete: [];
  toggle: [];
  'update:draft': [value: string];
  commit: [];
  cancel: [];
}>();

useTreeLine(() => props.selected);

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
  focusRenameInput();
  focusTimer = window.setInterval(() => {
    if (!props.editing || Date.now() > focusUntil) {
      window.clearInterval(focusTimer);
      return;
    }
    if (document.activeElement !== inputRef.value) {
      focusRenameInput();
    }
  }, 16);
}

watch(
  () => props.editing,
  (editing) => {
    if (!editing) {
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

watch(
  () => props.error,
  async (error) => {
    if (!error || !props.editing) {
      return;
    }
    await nextTick();
    inputRef.value?.focus();
  },
);

const shellClass = computed(() =>
  cn(
    'group/row relative flex min-h-0 items-center gap-x-tiny rounded-x-sm',
    props.zone === 'center' && 'ring-1 ring-accent',
  ),
);

const labelClass = computed(() =>
  cn(
    'min-w-0 flex-1 truncate py-xx-sm text-left font-roboto text-body-sm font-medium',
    props.selected ? 'text-accent' : 'text-on-surface',
    props.expandable ? 'pr-xx-lg' : 'group-hover/row:pr-lg',
  ),
);

function onCommit() {
  if (ignoreBlur) {
    ignoreBlur = false;
    return;
  }
  if (Date.now() < focusUntil && document.activeElement !== inputRef.value) {
    return;
  }
  emit('commit');
}

function onCancel() {
  ignoreBlur = true;
  emit('cancel');
}

function onRenameKeyDown(event: KeyboardEvent) {
  if (shortcuts.matchesKey(event, 'rename.commit')) {
    event.preventDefault();
    event.stopPropagation();
    onCommit();
    return;
  }
  if (shortcuts.matchesKey(event, 'rename.cancel')) {
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  }
}
</script>

<template>
  <div :class="shellClass">
    <span
      v-if="zone === 'before'"
      class="bg-accent pointer-events-none absolute inset-x-0 top-0 h-px"
    />
    <span
      v-if="zone === 'after'"
      class="bg-accent pointer-events-none absolute inset-x-0 bottom-0 h-px"
    />
    <div
      v-if="iconKinds.length > 0"
      class="gap-x-tiny flex shrink-0 items-center"
    >
      <SceneElementTypeIcon
        v-for="kind in iconKinds"
        :key="kind"
        :kind="kind"
        :selected="selected"
      />
    </div>
    <SceneElementTypeIcon
      v-else-if="iconKind"
      :kind="iconKind"
      :selected="selected"
    />
    <input
      v-if="editing"
      ref="inputRef"
      :value="draft"
      class="text-body-sm py-xx-sm font-roboto text-on-surface min-w-0 flex-1 bg-transparent outline-none"
      @input="emit('update:draft', ($event.target as HTMLInputElement).value)"
      @keydown="onRenameKeyDown"
      @blur="onCommit"
      @click.stop
      @keydown.stop
    />
    <span
      v-if="!editing"
      :class="labelClass"
    >
      {{ label }}
    </span>

    <div
      class="gap-tiny absolute inset-y-0 right-0 flex items-center"
      :class="
        expandable
          ? ''
          : 'pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100'
      "
    >
      <BaseIconButton
        :label="deleteLabel"
        class="opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100"
        @mousedown.stop
        @click.stop="emit('delete')"
      >
        <IconMinus />
      </BaseIconButton>
      <BaseIconButton
        v-if="expandable"
        :label="toggleLabel"
        @mousedown.stop
        @click.stop="emit('toggle')"
      >
        <IconChevronRight v-if="!open" />
        <IconChevronDown v-else />
      </BaseIconButton>
    </div>
  </div>
  <p
    v-if="editing && error"
    class="text-body-sm text-on-surface-dim"
  >
    {{ error }}
  </p>
</template>
