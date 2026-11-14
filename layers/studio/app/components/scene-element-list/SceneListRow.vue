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
    visible?: boolean;
    locked?: boolean;
    showLayerControls?: boolean;
    visibilityLabel?: string;
    lockLabel?: string;
    /** Input level in dB (−60…0) for an audio layer. Draws a left-to-right gradient mask. */
    levelDb?: number;
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
    visible: true,
    locked: false,
    showLayerControls: false,
    visibilityLabel: '',
    lockLabel: '',
    levelDb: undefined,
  },
);

const emit = defineEmits<{
  select: [event: MouseEvent];
  delete: [];
  toggle: [];
  toggleVisibility: [];
  toggleLocked: [];
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
    'group/row relative flex min-h-0 items-center gap-xxx-sm hover:bg-surface-container-high',
    props.zone === 'center' && 'ring-1 ring-inset ring-accent',
  ),
);

const labelClass = computed(() =>
  cn(
    'min-w-0 flex-1 truncate py-tiny text-left font-sans text-body-sm font-normal',
    props.selected ? 'text-accent' : props.visible === false ? 'text-on-surface-dim line-through' : 'text-on-surface',
    props.expandable ? 'pr-xx-lg' : props.showLayerControls ? 'pr-xx-xl' : 'group-hover/row:pr-lg',
  ),
);

const layerControlsVisible = computed(
  () => props.showLayerControls && (!props.visible || props.locked || props.selected),
);

/** Orbit level bar: 20 segments under the label, signal → warning → error. */
const LEVEL_SEGMENTS = 20;

const levelPercent = computed(() => {
  if (props.levelDb === undefined) {
    return 0;
  }
  const clamped = Math.min(0, Math.max(-60, props.levelDb));
  return ((clamped + 60) / 60) * 100;
});

const levelSegments = computed(() => {
  const lit = Math.round((levelPercent.value / 100) * LEVEL_SEGMENTS);
  return Array.from({ length: LEVEL_SEGMENTS }, (_, index) => {
    if (index >= lit) {
      return 'bg-surface-container-high';
    }
    if (index >= LEVEL_SEGMENTS - 2) {
      return 'bg-error';
    }
    if (index >= LEVEL_SEGMENTS - 5) {
      return 'bg-warning';
    }
    return 'bg-accent';
  });
});

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
      class="text-body-sm py-xx-sm text-on-surface border-accent min-w-0 flex-1 border-b bg-transparent font-sans outline-none"
      @input="emit('update:draft', ($event.target as HTMLInputElement).value)"
      @keydown="onRenameKeyDown"
      @blur="onCommit"
      @click.stop
      @keydown.stop
    />
    <span
      v-if="!editing"
      :class="cn(labelClass, levelDb !== undefined && 'relative')"
    >
      <span class="inline-block max-w-full truncate">
        {{ label }}
      </span>
      <span
        v-if="levelDb !== undefined"
        class="bottom-x-tiny h-x-tiny pointer-events-none absolute inset-x-0 grid grid-cols-[repeat(20,minmax(0,1fr))] gap-px"
        aria-hidden="true"
      >
        <span
          v-for="(segment, index) in levelSegments"
          :key="index"
          :class="segment"
        />
      </span>
    </span>

    <div
      class="gap-tiny absolute inset-y-0 right-0 flex items-center"
      :class="
        expandable
          ? ''
          : layerControlsVisible
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100'
      "
    >
      <template v-if="showLayerControls">
        <BaseIconButton
          :label="visibilityLabel"
          :class="visible ? '' : 'opacity-100'"
          @mousedown.stop
          @click.stop="emit('toggleVisibility')"
        >
          <Icon
            :name="visible ? 'mdi:eye-outline' : 'mdi:eye-off-outline'"
            class="size-4"
          />
        </BaseIconButton>
        <BaseIconButton
          :label="lockLabel"
          :class="locked ? 'opacity-100' : ''"
          @mousedown.stop
          @click.stop="emit('toggleLocked')"
        >
          <Icon
            :name="locked ? 'mdi:lock' : 'mdi:lock-open-variant-outline'"
            class="size-4"
          />
        </BaseIconButton>
      </template>
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
