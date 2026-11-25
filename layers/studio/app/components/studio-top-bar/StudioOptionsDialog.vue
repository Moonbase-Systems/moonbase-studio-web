<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui';

import { KEYBOARD_SHORTCUT_BINDINGS } from '../../config/keyboard-shortcuts';
import type { ShortcutActionId, ShortcutBinding } from '../../models/shortcut.domain';
import { useStudioSessionStore } from '../../store/studio-session.store';
import { OPTION_FIELD_CATALOG, type OptionFieldSpec, type StudioOptionSelectChoice } from './studio-option-catalog';
import { optionGroupClass, optionLabelClass, optionReadoutRowClass, optionRowClass } from './studio-option-classes';
import StudioOptionField from './StudioOptionField.vue';
import StudioOptionSelect from './StudioOptionSelect.vue';
import StudioOutputFormatSection from './StudioOutputFormatSection.vue';
import StudioRecordingSection from './StudioRecordingSection.vue';

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();
const store = useStudioSessionStore();

const SECTIONS = [
  'transmission',
  'picture',
  'devices',
  'control',
  'readout',
  'audio',
  'recording',
  'background',
  'shortcuts',
  'connection',
] as const;

type SectionId = (typeof SECTIONS)[number];

const ACTION_LABEL: Record<ShortcutActionId, string> = {
  'history.undo': 'studio.options.actions.undo',
  'history.redo': 'studio.options.actions.redo',
  rename: 'studio.options.actions.rename',
  'rename.commit': 'studio.options.actions.renameCommit',
  'rename.cancel': 'studio.options.actions.renameCancel',
  'reorder.up': 'studio.options.actions.reorderUp',
  'reorder.down': 'studio.options.actions.reorderDown',
  'selection.toggle': 'studio.options.actions.selectionToggle',
  'selection.range': 'studio.options.actions.selectionRange',
  'document.save': 'studio.options.actions.save',
  'document.open': 'studio.options.actions.open',
  'layer.delete': 'studio.options.actions.delete',
  'layer.duplicate': 'studio.options.actions.duplicate',
  'scene.create': 'studio.options.actions.newScene',
  'scene.next': 'studio.options.actions.nextScene',
  'scene.previous': 'studio.options.actions.previousScene',
  'audio.toggleMute': 'studio.options.actions.mute',
  'audio.pushToTalk': 'studio.options.actions.pushToTalk',
  'audio.pushToMute': 'studio.options.actions.pushToMute',
  'layer.toggleVisibility': 'studio.options.actions.visibility',
  'layer.toggleLock': 'studio.options.actions.lock',
  'selection.all': 'studio.options.actions.selectAll',
  'layer.nudgeLeft': 'studio.options.actions.nudgeLeft',
  'layer.nudgeRight': 'studio.options.actions.nudgeRight',
  'layer.nudgeUp': 'studio.options.actions.nudgeUp',
  'layer.nudgeDown': 'studio.options.actions.nudgeDown',
  'layer.nudgeLeftCoarse': 'studio.options.actions.nudgeLeftCoarse',
  'layer.nudgeRightCoarse': 'studio.options.actions.nudgeRightCoarse',
  'layer.nudgeUpCoarse': 'studio.options.actions.nudgeUpCoarse',
  'layer.nudgeDownCoarse': 'studio.options.actions.nudgeDownCoarse',
  'layer.toFront': 'studio.options.actions.toFront',
  'layer.toBack': 'studio.options.actions.toBack',
  'layer.group': 'studio.options.actions.group',
  'layer.ungroup': 'studio.options.actions.ungroup',
};

const BRIDGE_SHORTCUTS = [
  { label: 'studio.options.shortcuts.start', keys: 'Ctrl+Shift+Enter' },
  { label: 'studio.options.shortcuts.stop', keys: 'Ctrl+Shift+Backspace' },
  { label: 'studio.options.shortcuts.pause', keys: 'Ctrl+Shift+P' },
  { label: 'studio.options.shortcuts.record', keys: 'Ctrl+Shift+R' },
] as const;

const sectionId = ref<SectionId>('transmission');

const imageAssets = computed(() => store.project?.assets.filter((asset) => asset.type === 'image') ?? []);
const background = computed(() => store.activeScene?.background ?? { kind: 'none' as const });

const shortcutRows = computed(() => {
  const grouped = new Map<ShortcutActionId, string[]>();
  for (const binding of KEYBOARD_SHORTCUT_BINDINGS) {
    const keys = grouped.get(binding.actionId) ?? [];
    keys.push(formatBinding(binding));
    grouped.set(binding.actionId, keys);
  }
  return [...grouped].map(([actionId, keys]) => ({
    actionId,
    label: t(ACTION_LABEL[actionId]),
    keys: keys.join(', '),
    hold: actionId === 'audio.pushToTalk' || actionId === 'audio.pushToMute',
  }));
});

const LIVE_RECORDING_FIELDS = new Set([
  'quality',
  'recordingPath',
  'container',
  'filenamePattern',
  'recordingBitrateKbps',
]);

function fieldRows(section: SectionId): OptionFieldSpec[] {
  return OPTION_FIELD_CATALOG.filter(
    (row) => row.section === section && !(section === 'recording' && LIVE_RECORDING_FIELDS.has(row.id)),
  );
}

function showsFieldGroup(section: SectionId, index: number): boolean {
  const rows = fieldRows(section);
  const row = rows[index];
  if (!row) {
    return false;
  }
  return index === 0 || rows[index - 1]?.groupKey !== row.groupKey;
}

function fieldText(row: OptionFieldSpec): string {
  if (row.valueKey) {
    return t(row.valueKey);
  }
  const video = store.project?.settings.video;
  const audio = store.project?.settings.audio;
  if (row.id === 'colorSpace') {
    return video?.colorSpace ?? row.value ?? '';
  }
  if (row.id === 'sampleRate') {
    return String(audio?.sampleRate ?? row.value ?? '');
  }
  if (row.id === 'channels') {
    return String(audio?.channels ?? row.value ?? '');
  }
  return row.value ?? '';
}

function fieldChoices(row: OptionFieldSpec): { value: string; label: string }[] {
  return (row.choices ?? []).map((choice) => ({
    value: choice.value,
    label: choice.labelKey ? t(choice.labelKey) : choice.value,
  }));
}

/** Sections whose fields wait for the Bridge process. */
const BRIDGE_SECTIONS = new Set<SectionId>(['transmission', 'devices', 'readout', 'connection']);

/** Note under a section: what is not live yet and why. */
const SECTION_NOTE: Partial<Record<SectionId, string>> = {
  transmission: 'studio.options.rebuild.transmission',
  picture: 'studio.options.picture.rebuild',
  devices: 'studio.options.rebuild.devices',
  control: 'studio.options.rebuild.control',
  readout: 'studio.options.rebuild.readout',
  audio: 'studio.options.rebuild.audio',
  connection: 'studio.options.rebuild.connection',
};

const backgroundKindChoices = computed<StudioOptionSelectChoice[]>(() => [
  { value: 'none', label: t('studio.options.background.none') },
  { value: 'color', label: t('studio.options.background.color') },
  {
    value: 'image',
    label: t('studio.options.background.image'),
    disabled: imageAssets.value.length === 0 && background.value.kind !== 'image',
  },
]);

const backgroundAssetChoices = computed<StudioOptionSelectChoice[]>(() =>
  imageAssets.value.map((asset) => ({ value: asset.id, label: asset.name })),
);

const backgroundColor = computed(() => (background.value.kind === 'color' ? background.value.color : '#ffffff'));
const backgroundAssetId = computed(() => (background.value.kind === 'image' ? background.value.assetId : ''));

function formatBinding(binding: ShortcutBinding): string {
  if (binding.kind === 'pointer') {
    const mod = binding.binding.modifiers.includes('shift') ? 'Shift' : 'Ctrl';
    return `${mod}+${t('studio.options.shortcuts.click')}`;
  }
  const mods = binding.binding.modifiers ?? [];
  const parts: string[] = [];
  if (mods.includes('mod')) {
    parts.push('Ctrl');
  }
  if (mods.includes('shift')) {
    parts.push('Shift');
  }
  if (mods.includes('alt')) {
    parts.push('Alt');
  }
  parts.push(arrowLabel(binding.binding.key));
  return parts.join('+');
}

function arrowLabel(key: string): string {
  switch (key) {
    case 'ArrowLeft':
      return '←';
    case 'ArrowRight':
      return '→';
    case 'ArrowUp':
      return '↑';
    case 'ArrowDown':
      return '↓';
    case '`':
      return '`';
    case '\\':
      return '\\';
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

function setBackgroundKind(kind: 'none' | 'color' | 'image') {
  const scene = store.activeScene;
  if (!scene) {
    return;
  }
  if (kind === 'none') {
    store.setSceneBackground(scene.id, { kind: 'none' });
    return;
  }
  if (kind === 'color') {
    const color = scene.background.kind === 'color' ? scene.background.color : '#ffffff';
    store.setSceneBackground(scene.id, { kind: 'color', color });
    return;
  }
  const assetId = scene.background.kind === 'image' ? scene.background.assetId : imageAssets.value[0]?.id;
  if (!assetId) {
    return;
  }
  store.setSceneBackground(scene.id, { kind: 'image', assetId });
}

function onKindChange(value: string) {
  if (value === 'none' || value === 'color' || value === 'image') {
    setBackgroundKind(value);
  }
}

function onColorChange(event: Event) {
  const scene = store.activeScene;
  const color = (event.target as HTMLInputElement).value;
  if (!scene || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return;
  }
  store.setSceneBackground(scene.id, { kind: 'color', color });
}

function onAssetChange(assetId: string) {
  const scene = store.activeScene;
  if (!scene || !assetId) {
    return;
  }
  store.setSceneBackground(scene.id, { kind: 'image', assetId });
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50" />
      <DialogContent
        class="border-line bg-surface-container p-xxxx-lg gap-xxxx-lg fixed left-1/2 top-1/2 z-50 flex h-[min(72rem,calc(100dvh-6.4rem))] w-[min(96rem,calc(100vw-3.2rem))] -translate-x-1/2 -translate-y-1/2 flex-col border outline-none"
      >
        <BaseFrameBrackets
          corners="all"
          tone="accent"
        />
        <div class="gap-md flex items-start justify-between">
          <div class="gap-tiny flex min-w-0 flex-col">
            <span class="text-label text-on-surface-dim truncate font-mono uppercase">
              {{ store.project?.name }}
            </span>
            <DialogTitle class="text-title text-on-surface font-sans font-light">
              {{ t('studio.options.title') }}
            </DialogTitle>
            <DialogDescription class="sr-only">
              {{ t('studio.options.title') }}
            </DialogDescription>
          </div>
          <DialogClose as-child>
            <BaseIconButton
              class="size-control"
              :label="t('studio.options.close')"
            >
              <Icon
                name="mdi:close"
                class="size-md"
              />
            </BaseIconButton>
          </DialogClose>
        </div>

        <div class="flex min-h-0 flex-1">
          <div
            class="border-line pr-md flex w-[20rem] shrink-0 flex-col overflow-y-auto border-r"
            role="tablist"
            aria-orientation="vertical"
            :aria-label="t('studio.options.title')"
          >
            <button
              v-for="section in SECTIONS"
              :key="section"
              type="button"
              role="tab"
              class="text-body-sm focus-visible:ring-accent h-row px-xxx-sm gap-xxx-sm duration-short flex shrink-0 items-center justify-between border-l-2 text-left font-sans outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset"
              :class="
                sectionId === section
                  ? 'border-accent text-accent'
                  : 'text-on-surface hover:bg-surface-container-high border-transparent'
              "
              :aria-selected="sectionId === section"
              @click="sectionId = section"
            >
              <span class="min-w-0 truncate">{{ t(`studio.options.sections.${section}`) }}</span>
              <span
                v-if="BRIDGE_SECTIONS.has(section)"
                class="text-label text-warning shrink-0 font-mono uppercase"
              >
                {{ t('studio.options.rebuild.bridge') }}
              </span>
            </button>
          </div>

          <div
            class="pl-xxxx-lg gap-md flex min-w-0 flex-1 flex-col"
            role="tabpanel"
          >
            <div class="min-h-0 flex-1 overflow-y-auto">
              <div
                v-if="sectionId === 'picture'"
                class="gap-xxx-sm flex flex-col"
              >
                <StudioOutputFormatSection />
                <template
                  v-for="(row, index) in fieldRows('picture')"
                  :key="row.id"
                >
                  <p
                    v-if="showsFieldGroup('picture', index)"
                    :class="[optionGroupClass, 'mt-xx-lg']"
                  >
                    {{ t(row.groupKey) }}
                  </p>
                  <StudioOptionField
                    :label="t(row.labelKey)"
                    :off="row.off"
                    :kind="row.kind"
                    :text="fieldText(row)"
                    :checked="row.checked"
                    :choices="fieldChoices(row)"
                  />
                </template>
              </div>

              <div
                v-else-if="sectionId === 'recording'"
                class="gap-xxx-sm flex flex-col"
              >
                <StudioRecordingSection />
                <template
                  v-for="(row, index) in fieldRows('recording')"
                  :key="row.id"
                >
                  <p
                    v-if="showsFieldGroup('recording', index)"
                    :class="[optionGroupClass, 'mt-xx-lg']"
                  >
                    {{ t(row.groupKey) }}
                  </p>
                  <StudioOptionField
                    :label="t(row.labelKey)"
                    :off="row.off"
                    :kind="row.kind"
                    :text="fieldText(row)"
                    :checked="row.checked"
                    :choices="fieldChoices(row)"
                  />
                </template>
              </div>

              <div
                v-else-if="sectionId === 'background'"
                class="gap-xxx-sm flex flex-col"
              >
                <p :class="optionGroupClass">{{ t('studio.options.sections.background') }}</p>
                <div :class="optionRowClass">
                  <label
                    :class="optionLabelClass"
                    for="studio-options-background-kind"
                  >
                    {{ t('studio.options.background.kind') }}
                  </label>
                  <StudioOptionSelect
                    id="studio-options-background-kind"
                    :model-value="background.kind"
                    :choices="backgroundKindChoices"
                    :disabled="!store.activeScene"
                    @update:model-value="onKindChange"
                  />
                </div>
                <div
                  v-if="background.kind === 'color'"
                  :class="optionRowClass"
                >
                  <label
                    :class="optionLabelClass"
                    for="studio-options-background-color"
                  >
                    {{ t('studio.options.background.color') }}
                  </label>
                  <span
                    class="border-on-surface-dim focus-within:border-accent size-control duration-short relative shrink-0 cursor-pointer border transition-colors"
                    :style="{ backgroundColor: backgroundColor }"
                  >
                    <input
                      id="studio-options-background-color"
                      class="absolute inset-0 size-full cursor-pointer opacity-0"
                      type="color"
                      :value="backgroundColor"
                      @change="onColorChange"
                    />
                  </span>
                  <span class="text-label text-on-surface-dim font-mono uppercase tabular-nums">
                    {{ backgroundColor }}
                  </span>
                </div>
                <div
                  v-else-if="background.kind === 'image'"
                  :class="optionRowClass"
                >
                  <label
                    :class="optionLabelClass"
                    for="studio-options-background-asset"
                  >
                    {{ t('studio.options.background.asset') }}
                  </label>
                  <StudioOptionSelect
                    id="studio-options-background-asset"
                    :model-value="backgroundAssetId"
                    :choices="backgroundAssetChoices"
                    @update:model-value="onAssetChange"
                  />
                </div>
                <p
                  v-if="imageAssets.length === 0"
                  class="text-body-sm text-on-surface-dim font-sans"
                >
                  {{ t('studio.options.background.empty') }}
                </p>
              </div>

              <div
                v-else-if="sectionId === 'shortcuts'"
                class="gap-xx-lg flex flex-col"
              >
                <ul class="flex flex-col">
                  <li
                    v-for="row in shortcutRows"
                    :key="row.actionId"
                    :class="optionReadoutRowClass"
                  >
                    <span class="text-body-sm text-on-surface min-w-0 truncate font-sans">
                      {{ row.label }}
                      <span
                        v-if="row.hold"
                        class="text-on-surface-dim"
                      >
                        {{ t('studio.options.shortcuts.hold') }}
                      </span>
                    </span>
                    <span class="text-label text-on-surface-dim shrink-0 font-mono uppercase">{{ row.keys }}</span>
                  </li>
                </ul>
                <div class="gap-xxx-sm flex flex-col">
                  <span class="text-label text-warning font-mono uppercase">
                    {{ t('studio.options.rebuild.bridge') }}
                  </span>
                  <ul class="flex flex-col">
                    <li
                      v-for="row in BRIDGE_SHORTCUTS"
                      :key="row.label"
                      :class="optionReadoutRowClass"
                    >
                      <span class="text-body-sm text-on-surface-dim min-w-0 truncate font-sans">{{
                        t(row.label)
                      }}</span>
                      <span class="text-label text-on-surface-dim shrink-0 font-mono uppercase">{{ row.keys }}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div
                v-else
                class="gap-xxx-sm flex flex-col"
              >
                <template
                  v-for="(row, index) in fieldRows(sectionId)"
                  :key="row.id"
                >
                  <p
                    v-if="showsFieldGroup(sectionId, index)"
                    :class="[optionGroupClass, index === 0 ? '' : 'mt-xx-lg']"
                  >
                    {{ t(row.groupKey) }}
                  </p>
                  <StudioOptionField
                    :label="t(row.labelKey)"
                    :off="row.off"
                    :kind="row.kind"
                    :text="fieldText(row)"
                    :checked="row.checked"
                    :choices="fieldChoices(row)"
                  />
                </template>
              </div>
            </div>

            <div
              v-if="SECTION_NOTE[sectionId]"
              class="border-line pt-md gap-x-sm flex shrink-0 items-start border-t"
            >
              <BaseStatusBadge
                state="warning"
                :label="t('studio.options.rebuild.label')"
                class="pt-x-tiny"
              />
              <p class="text-body-sm text-on-surface-dim max-w-[46rem] font-sans">
                {{ t(SECTION_NOTE[sectionId] ?? '') }}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
