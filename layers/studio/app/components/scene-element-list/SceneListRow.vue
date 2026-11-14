<script setup lang="ts">
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
    /** Input level in dB (−60…0) for an audio layer. */
    levelDb?: number;
    /** Orbit tree depth: 1 = layer under scene, 2 = member in group. */
    treeDepth?: number;
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
    treeDepth: 0,
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

const treeRailActive = computed(() => props.treeDepth > 0 && !props.expandable && props.selected);

const indentStyle = computed(() => (props.treeDepth > 0 ? { width: `${props.treeDepth * 1.2}rem` } : undefined));

const shellClass = computed(() =>
  cn(
    'group/row relative flex min-h-row min-w-0 items-center gap-xxx-sm pr-tiny hover:bg-surface-container-high',
    props.zone === 'center' && 'ring-1 ring-inset ring-accent',
  ),
);

const labelClass = computed(() =>
  cn(
    'block min-w-0 truncate py-tiny text-left font-sans text-body-sm font-normal',
    props.selected ? 'text-accent' : props.visible === false ? 'text-on-surface-dim' : 'text-on-surface',
  ),
);

const layerActionsPinned = computed(() => props.showLayerControls && (props.visible === false || props.locked));

/** Group rows pin delete/toggle like Orbit `kind !== layer`. */
const rowActionsPinned = computed(() => props.expandable || layerActionsPinned.value);

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
  return Array.from({ length: LEVEL_SEGMENTS }, (_, index) =>
    index < lit ? 'bg-accent' : 'bg-surface-container-high',
  );
});

const rowActionBtnClass = 'inline-flex size-6 shrink-0 items-center justify-center p-0';

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

    <span
      v-if="treeDepth > 0"
      class="relative shrink-0 self-stretch"
      :style="indentStyle"
      aria-hidden="true"
    >
      <span
        class="left-tiny absolute bottom-0 top-0 w-px"
        :class="treeRailActive ? 'bg-accent' : 'bg-line'"
      />
    </span>

    <div
      v-if="iconKinds.length > 0"
      class="gap-x-tiny flex shrink-0 items-center"
    >
      <SceneElementTypeIcon
        v-for="kind in iconKinds"
        :key="kind"
        :kind="kind"
      />
    </div>
    <SceneElementTypeIcon
      v-else-if="iconKind"
      class="shrink-0"
      :kind="iconKind"
    />

    <input
      v-if="editing"
      ref="inputRef"
      :value="draft"
      class="text-body-sm py-tiny text-on-surface border-accent min-w-0 flex-1 border-b bg-transparent font-sans outline-none"
      @input="emit('update:draft', ($event.target as HTMLInputElement).value)"
      @keydown="onRenameKeyDown"
      @blur="onCommit"
      @click.stop
      @keydown.stop
    />

    <div
      v-else
      class="min-w-0 flex-1"
    >
      <span :class="labelClass">
        {{ label }}
      </span>
      <span
        v-if="levelDb !== undefined"
        class="mt-x-tiny h-x-tiny pointer-events-none grid w-full grid-cols-[repeat(20,minmax(0,1fr))] gap-px"
        aria-hidden="true"
      >
        <span
          v-for="(segment, index) in levelSegments"
          :key="index"
          :class="segment"
        />
      </span>
    </div>

    <div
      class="duration-short flex shrink-0 items-center gap-0 transition-opacity"
      :class="
        rowActionsPinned
          ? 'opacity-100'
          : 'pointer-events-none opacity-0 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100 group-hover/row:pointer-events-auto group-hover/row:opacity-100'
      "
    >
      <template v-if="showLayerControls">
        <BaseIconButton
          :label="visibilityLabel"
          :class="cn(rowActionBtnClass, visible === false && 'text-accent')"
          :aria-pressed="visible === false"
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
          :class="cn(rowActionBtnClass, locked && 'text-accent')"
          :aria-pressed="locked"
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
        :class="rowActionBtnClass"
        @mousedown.stop
        @click.stop="emit('delete')"
      >
        <IconMinus class="size-4" />
      </BaseIconButton>
      <BaseIconButton
        v-if="expandable"
        :label="toggleLabel"
        :class="rowActionBtnClass"
        @mousedown.stop
        @click.stop="emit('toggle')"
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
    v-if="editing && error"
    class="text-body-sm text-on-surface-dim"
  >
    {{ error }}
  </p>
</template>
