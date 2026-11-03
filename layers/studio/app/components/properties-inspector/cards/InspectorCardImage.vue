<script setup lang="ts">
import { cn } from '~/utils/index';

import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { FitMode } from '../../../models/common.domain';
import type { SceneId } from '../../../models/ids.domain';
import type { ImageElement } from '../../../models/scene-elements';
import type { ImageSource } from '../../../models/source.domain';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import { holdImagePreviewUrl } from '../image-preview-url';

const props = defineProps<{
  sceneId: SceneId;
  element: ImageElement;
}>();

const { t } = useI18n();
const store = useStudioSessionStore();
const { applyUpdate, updateSettings } = useElementInspectorUpdate();

const fitModes = ['contain', 'cover', 'fill', 'none'] as const satisfies readonly FitMode[];

const menu = ref<'source' | 'fit' | null>(null);
const sourceTriggerRef = ref<HTMLButtonElement | null>(null);
const fitTriggerRef = ref<HTMLButtonElement | null>(null);
const fileRef = ref<HTMLInputElement | null>(null);
const panelStyle = ref<Record<string, string>>({ left: '0px', bottom: '0px' });

const textControlClass = 'font-inter text-body-sm font-medium tracking-normal text-white';
const labelClass = cn(textControlClass, 'shrink-0');
const fieldShellClass =
  'flex h-[24px] items-center gap-[8px] border border-transparent bg-[color-mix(in_srgb,white_5%,#050004)] px-[8px]';

const imageSources = computed(() =>
  (store.project?.sources.filter((source) => source.type === 'image') ?? []).filter((source) => !isPlaceholder(source)),
);

function isPlaceholder(source: ImageSource) {
  const asset = store.project?.assets.find((item) => item.id === source.assetId);
  return asset?.location.kind === 'storageKey' && asset.location.key === 'pending/image';
}
const sourceLabel = computed(() => {
  const source = store.project?.sources.find((item) => item.id === props.element.sourceId);
  return source?.name ?? props.element.sourceId;
});

function placePanel(trigger: HTMLButtonElement | null, width: number) {
  if (!trigger) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth - width - 8);
  panelStyle.value = {
    left: `${Math.max(8, left)}px`,
    bottom: `${window.innerHeight - rect.top + 4}px`,
    width: `${width}px`,
  };
}

function toggleMenu(next: 'source' | 'fit') {
  if (menu.value === next) {
    menu.value = null;
    return;
  }
  placePanel(next === 'source' ? sourceTriggerRef.value : fitTriggerRef.value, next === 'source' ? 200 : 160);
  menu.value = next;
}

function openFilePicker() {
  fileRef.value?.click();
}

function sourceNameFromFile(file: File) {
  const withoutExtension = file.name.replace(/\.[^.]+$/, '').trim();
  const name = withoutExtension || file.name.trim() || 'image';
  return name.slice(0, 128);
}

function readImageSize(url: string) {
  return new Promise<{ width?: number; height?: number }>((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth > 0 ? image.naturalWidth : undefined,
        height: image.naturalHeight > 0 ? image.naturalHeight : undefined,
      });
    };
    image.onerror = () => resolve({});
    image.src = url;
  });
}

async function onFile(event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const file = input.files?.[0];
  input.value = '';
  if (!file) {
    return;
  }

  const url = URL.createObjectURL(file);
  const size = await readImageSize(url);
  const assetIdsBefore = new Set(store.project?.assets.map((asset) => asset.id) ?? []);
  const sourceIdsBefore = new Set(store.project?.sources.map((source) => source.id) ?? []);
  const previousSourceId = props.element.sourceId;
  const previousSource = store.project?.sources.find((source) => source.id === previousSourceId);
  const previousWasPlaceholder = previousSource?.type === 'image' && isPlaceholder(previousSource);

  const result = store.runTransaction(() => {
    const added = store.addAsset({
      name: file.name.slice(0, 256),
      type: 'image',
      location: { kind: 'storageKey', key: `local/${crypto.randomUUID()}` },
      availability: 'available',
      metadata: {
        mimeType: file.type || undefined,
        byteSize: file.size,
        width: size.width,
        height: size.height,
      },
    });
    if (!added.ok) {
      return added;
    }

    const asset = store.project?.assets.find((item) => !assetIdsBefore.has(item.id));
    if (!asset) {
      return { ok: false as const, error: { kind: 'invalid-state' as const, reason: 'Asset was not created' } };
    }

    const sourced = store.addSource({
      type: 'image',
      name: sourceNameFromFile(file),
      assetId: asset.id,
    });
    if (!sourced.ok) {
      return sourced;
    }

    const source = store.project?.sources.find((item) => !sourceIdsBefore.has(item.id));
    if (!source) {
      return { ok: false as const, error: { kind: 'invalid-state' as const, reason: 'Source was not created' } };
    }

    holdImagePreviewUrl(asset.id, url);
    return store.updateLayer(props.sceneId, props.element.id, { sourceId: source.id });
  });

  if (!result.ok) {
    URL.revokeObjectURL(url);
    return;
  }

  menu.value = null;
  if (previousWasPlaceholder) {
    store.removeSource(previousSourceId);
  }
}

function pickSource(sourceId: string) {
  const ok = applyUpdate(props.sceneId, props.element.id, { sourceId });
  if (ok) {
    menu.value = null;
  }
}

function pickFit(fitMode: FitMode) {
  updateSettings(props.sceneId, props.element, { fitMode });
  menu.value = null;
}

function toggleSmoothing() {
  updateSettings(props.sceneId, props.element, { smoothing: !props.element.settings.smoothing });
}

function commitCornerRadius(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  updateSettings(props.sceneId, props.element, { cornerRadius: Math.max(0, value) });
}
</script>

<template>
  <div class="flex w-full max-w-[464px] flex-col items-center gap-[8px]">
    <div class="flex w-full flex-wrap items-center justify-center gap-[8px] bg-[#050004] p-[6px]">
      <span :class="labelClass">{{ t('studio.properties.labels.source') }}</span>
      <div :class="cn(fieldShellClass, textControlClass, 'min-w-[120px]')">
        <button
          type="button"
          class="min-w-0 flex-1 truncate text-left"
          @click="openFilePicker"
        >
          {{ sourceLabel }}
        </button>
        <button
          ref="sourceTriggerRef"
          type="button"
          class="text-[12px] transition-transform duration-200"
          :class="menu === 'source' ? 'rotate-180' : ''"
          :aria-expanded="menu === 'source'"
          :aria-label="t('studio.properties.labels.source')"
          @click="toggleMenu('source')"
        >
          &gt;
        </button>
      </div>
      <input
        ref="fileRef"
        type="file"
        accept="image/*"
        class="hidden"
        :aria-label="t('studio.properties.labels.file')"
        @change="onFile"
      />
    </div>

    <div class="flex w-full flex-wrap items-center justify-center gap-[8px] bg-[#050004] p-[6px]">
      <span :class="labelClass">{{ t('studio.properties.fields.fitMode') }}</span>
      <button
        ref="fitTriggerRef"
        type="button"
        :class="cn(fieldShellClass, textControlClass)"
        :aria-expanded="menu === 'fit'"
        @click="toggleMenu('fit')"
      >
        {{ t(`studio.properties.fitModes.${element.settings.fitMode}`) }}
        <span
          class="text-[12px] transition-transform duration-200"
          :class="menu === 'fit' ? 'rotate-180' : ''"
        >
          &gt;
        </span>
      </button>
    </div>

    <div class="flex w-full flex-wrap items-center justify-center gap-[8px] bg-[#050004] p-[6px]">
      <BaseScrubField
        compact
        :label="t('studio.properties.fields.cornerRadius')"
        field-suffix="horizontal"
        suffix="px"
        field-class="w-[72px]"
        :model-value="element.settings.cornerRadius"
        :min="0"
        @change="commitCornerRadius"
      />
      <button
        type="button"
        :class="
          cn(
            textControlClass,
            'flex h-[24px] items-center justify-center border px-[8px]',
            element.settings.smoothing
              ? 'border-[#22FF86] text-[#22FF86]'
              : 'border-transparent bg-[color-mix(in_srgb,white_5%,#050004)] text-white',
          )
        "
        :aria-pressed="element.settings.smoothing"
        @click="toggleSmoothing"
      >
        {{ t('studio.properties.fields.smoothing') }}
      </button>
    </div>

    <Teleport to="body">
      <button
        v-if="menu"
        type="button"
        class="fixed inset-0 z-40 cursor-default bg-transparent"
        aria-label="close"
        @click="menu = null"
      />
      <div
        v-if="menu === 'source'"
        class="fixed z-50 flex flex-col gap-[4px] border border-white/15 bg-[color-mix(in_srgb,white_8%,#050004)] p-[6px]"
        :style="panelStyle"
      >
        <button
          type="button"
          :class="cn(textControlClass, 'flex h-[24px] items-center px-[8px] text-left')"
          @click="openFilePicker"
        >
          {{ t('studio.properties.labels.file') }}
        </button>
        <button
          v-for="source in imageSources"
          :key="source.id"
          type="button"
          :class="
            cn(
              textControlClass,
              'flex h-[24px] items-center px-[8px] text-left',
              source.id === element.sourceId && 'text-[#22FF86]',
            )
          "
          @click="pickSource(source.id)"
        >
          <span class="truncate">{{ source.name }}</span>
        </button>
      </div>
      <div
        v-if="menu === 'fit'"
        class="fixed z-50 flex flex-col gap-[4px] border border-white/15 bg-[color-mix(in_srgb,white_8%,#050004)] p-[6px]"
        :style="panelStyle"
      >
        <button
          v-for="fitMode in fitModes"
          :key="fitMode"
          type="button"
          :class="
            cn(
              textControlClass,
              'flex h-[24px] items-center px-[8px] text-left',
              fitMode === element.settings.fitMode && 'text-[#22FF86]',
            )
          "
          @click="pickFit(fitMode)"
        >
          {{ t(`studio.properties.fitModes.${fitMode}`) }}
        </button>
      </div>
    </Teleport>
  </div>
</template>
