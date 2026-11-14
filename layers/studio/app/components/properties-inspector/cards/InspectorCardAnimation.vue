<script setup lang="ts">
import { cn } from '~/utils/index';

import type { SceneId } from '../../../models/ids.domain';
import type { AnimationElement } from '../../../models/scene-elements';
import type { AnimationEndBehavior, AnimationPlaybackTrigger } from '../../../models/source.domain';
import { capabilitiesForMediaKind } from '../../../playback/animation-player';
import { peekAnimationControls } from '../../../playback/animation-player-registry';
import { holdAnimationPreviewUrl } from '../../../playback/animation-preview-url';
import { detectAnimationFile } from '../../../playback/detect-animation-file';
import { readMediaPixelSize } from '../../../playback/read-media-pixel-size';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import {
  inspectorControlTextClass,
  inspectorFieldShellClass,
  inspectorLabelClass,
  inspectorMenuItemClass,
  inspectorMenuPanelClass,
  inspectorRowClass,
  inspectorToggleClass,
} from '../inspector-control-classes';

const props = defineProps<{
  sceneId: SceneId;
  element: AnimationElement;
}>();

const { t } = useI18n();
const store = useStudioSessionStore();

const textControlClass = inspectorControlTextClass;
const labelClass = inspectorLabelClass;
const rowClass = inspectorRowClass;
const fieldShellClass = inspectorFieldShellClass;

const fileRef = ref<HTMLInputElement | null>(null);
const fileError = ref<'unsupported' | 'static' | 'unreadable' | null>(null);
const menu = ref<'trigger' | 'end' | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const endRef = ref<HTMLButtonElement | null>(null);
const panelStyle = ref<Record<string, string>>({ left: '0px', bottom: '0px' });

const triggerOptions = ['after-delay', 'interval', 'manual'] as const;
const endOptions = ['hold', 'reset', 'hide', 'stop'] as const satisfies readonly AnimationEndBehavior[];

const source = computed(() => {
  const linked = store.project?.sources.find((item) => item.id === props.element.sourceId);
  return linked?.type === 'animation' ? linked : null;
});

const capabilities = computed(() => capabilitiesForMediaKind(source.value?.mediaKind ?? 'gif'));

const shownTrigger = computed(() => {
  const trigger = source.value?.trigger;
  if (trigger === 'on-activate') {
    return 'on-scene-start';
  }
  return trigger ?? 'manual';
});

function placePanel(trigger: HTMLButtonElement | null) {
  if (!trigger) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  panelStyle.value = {
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - 180))}px`,
    bottom: `${window.innerHeight - rect.top + 4}px`,
    width: '172px',
  };
}

function toggleMenu(next: 'trigger' | 'end') {
  if (menu.value === next) {
    menu.value = null;
    return;
  }
  placePanel(next === 'trigger' ? triggerRef.value : endRef.value);
  menu.value = next;
}

function patch(changes: Parameters<typeof store.updateAnimationSource>[1]) {
  const current = source.value;
  if (!current) {
    return;
  }
  store.updateAnimationSource(current.id, changes);
}

function sourceNameFromFile(file: File) {
  const withoutExtension = file.name.replace(/\.[^.]+$/, '').trim();
  return (withoutExtension || file.name.trim() || 'animation').slice(0, 128);
}

async function onFile(event: Event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const file = input.files?.[0];
  input.value = '';
  const current = source.value;
  if (!file || !current) {
    return;
  }
  const detected = await detectAnimationFile(file);
  if (!detected.ok) {
    fileError.value = detected.reason;
    return;
  }
  fileError.value = null;
  const url = URL.createObjectURL(file);
  const size = await readMediaPixelSize(url, detected.mediaKind);
  const assetIdsBefore = new Set(store.project?.assets.map((asset) => asset.id) ?? []);
  const result = store.runTransaction(() => {
    const added = store.addAsset({
      name: file.name.slice(0, 256),
      type: detected.mediaKind === 'video' ? 'video' : 'gif',
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
    holdAnimationPreviewUrl(asset.id, url);
    const updated = store.updateAnimationSource(current.id, {
      assetId: asset.id,
      mediaKind: detected.mediaKind,
      format: detected.format,
    });
    if (!updated.ok) {
      return updated;
    }
    const renamed = store.renameSource(current.id, sourceNameFromFile(file));
    if (!renamed.ok || !size.width || !size.height) {
      return renamed;
    }
    return store.updateLayer(props.sceneId, props.element.id, {
      transform: { width: size.width, height: size.height },
    });
  });
  if (!result.ok) {
    URL.revokeObjectURL(url);
  }
}

function commitNumber(
  key: 'startOffsetMs' | 'startPositionMs' | 'intervalMs' | 'repeatCount' | 'playbackRate',
  raw: string,
) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  if (key === 'playbackRate') {
    patch({ playbackRate: Math.min(8, Math.max(0.25, value)) });
    return;
  }
  if (key === 'intervalMs') {
    patch({ intervalMs: value <= 0 ? null : Math.round(value) });
    return;
  }
  if (key === 'repeatCount') {
    patch({ repeatCount: value <= 0 ? 1 : Math.round(value) });
    return;
  }
  patch({ [key]: Math.max(0, Math.round(value)) });
}

function pickTrigger(trigger: AnimationPlaybackTrigger) {
  patch({ trigger });
  menu.value = null;
}

function pickEnd(endBehavior: AnimationEndBehavior) {
  patch({ endBehavior });
  menu.value = null;
}

function control(action: 'play' | 'pause' | 'stop' | 'restart') {
  peekAnimationControls(props.element.id)?.[action]();
}

function toggleClass(active: boolean, disabled = false) {
  return inspectorToggleClass(active, disabled);
}
</script>

<template>
  <div
    v-if="source"
    class="gap-xxx-sm flex w-full min-w-0 flex-col items-stretch"
  >
    <div :class="rowClass">
      <span :class="labelClass">{{ t('studio.properties.labels.file') }}</span>
      <button
        type="button"
        :class="cn(fieldShellClass, 'max-w-[220px]')"
        @click="fileRef?.click()"
      >
        <span class="truncate">{{ source.assetId ? source.name : t('studio.properties.animation.noFile') }}</span>
      </button>
      <span
        v-if="source.assetId"
        :class="labelClass"
        >{{ source.format }}</span
      >
      <input
        ref="fileRef"
        type="file"
        accept=".gif,.webp,.png,.apng,.webm,.mp4,image/gif,image/webp,image/png,image/apng,video/webm,video/mp4"
        class="hidden"
        @change="onFile"
      />
    </div>
    <p
      v-if="fileError"
      :class="cn(textControlClass, 'text-error text-center')"
    >
      {{ t(`studio.properties.animation.${fileError}`) }}
    </p>
    <div :class="rowClass">
      <span :class="labelClass">{{ t('studio.properties.animation.playback') }}</span>
      <button
        type="button"
        :class="toggleClass(source.playbackMode === 'once', !capabilities.loopCount)"
        :disabled="!capabilities.loopCount"
        @click="patch({ playbackMode: 'once' })"
      >
        {{ t('studio.properties.animation.once') }}
      </button>
      <button
        type="button"
        :class="toggleClass(source.playbackMode === 'loop', !capabilities.loopCount)"
        :disabled="!capabilities.loopCount"
        @click="patch({ playbackMode: 'loop', repeatCount: null })"
      >
        {{ t('studio.properties.animation.loop') }}
      </button>
      <BaseScrubField
        v-if="source.playbackMode === 'once'"
        compact
        :disabled="!capabilities.loopCount"
        :label="t('studio.properties.animation.repeats')"
        field-suffix="horizontal"
        field-class="w-[64px]"
        :model-value="source.repeatCount ?? 1"
        :min="1"
        @change="commitNumber('repeatCount', $event)"
      />
      <BaseScrubField
        compact
        :disabled="!capabilities.rate"
        :label="t('studio.properties.animation.speed')"
        field-suffix="horizontal"
        suffix="x"
        field-class="w-[64px]"
        :step="0.25"
        :model-value="source.playbackRate"
        :min="0.25"
        :max="8"
        @change="commitNumber('playbackRate', $event)"
      />
    </div>

    <div :class="rowClass">
      <InspectorHintText
        :text-class="labelClass"
        :hint="t('studio.properties.animation.startHint')"
      >
        {{ t('studio.properties.animation.start') }}
      </InspectorHintText>
      <BaseScrubField
        compact
        label=""
        :disabled="!capabilities.seek"
        field-suffix="horizontal"
        suffix="ms"
        field-class="w-[72px]"
        :model-value="source.startPositionMs"
        :min="0"
        @change="commitNumber('startPositionMs', $event)"
      />
    </div>

    <div :class="rowClass">
      <span :class="labelClass">{{ t('studio.properties.animation.trigger') }}</span>
      <button
        ref="triggerRef"
        type="button"
        :class="fieldShellClass"
        @click="toggleMenu('trigger')"
      >
        {{ t(`studio.properties.animation.triggers.${shownTrigger}`) }}
      </button>
      <InspectorHintText
        :text-class="labelClass"
        :hint="t('studio.properties.animation.delayHint')"
      >
        {{ t('studio.properties.animation.delay') }}
      </InspectorHintText>
      <BaseScrubField
        compact
        label=""
        field-suffix="horizontal"
        suffix="ms"
        field-class="w-[72px]"
        :model-value="source.startOffsetMs"
        :min="0"
        @change="commitNumber('startOffsetMs', $event)"
      />
      <BaseScrubField
        v-if="source.trigger === 'interval'"
        compact
        :label="t('studio.properties.animation.interval')"
        field-suffix="horizontal"
        suffix="ms"
        field-class="w-[72px]"
        :model-value="source.intervalMs ?? 0"
        :min="0"
        @change="commitNumber('intervalMs', $event)"
      />
    </div>

    <div :class="rowClass">
      <span :class="labelClass">{{ t('studio.properties.animation.after') }}</span>
      <button
        ref="endRef"
        type="button"
        :class="fieldShellClass"
        :disabled="!capabilities.ended"
        @click="toggleMenu('end')"
      >
        {{ t(`studio.properties.animation.ends.${source.endBehavior}`) }}
      </button>
      <button
        type="button"
        :class="toggleClass(source.pauseOnHide, !capabilities.pause)"
        :disabled="!capabilities.pause"
        @click="patch({ pauseOnHide: !source.pauseOnHide })"
      >
        {{ t('studio.properties.animation.pauseOnHide') }}
      </button>
      <button
        type="button"
        :class="toggleClass(source.resetOnSceneStart)"
        @click="patch({ resetOnSceneStart: !source.resetOnSceneStart })"
      >
        {{ t('studio.properties.animation.resetOnScene') }}
      </button>
    </div>

    <div :class="rowClass">
      <button
        type="button"
        :class="toggleClass(false)"
        @click="control('play')"
      >
        {{ t('studio.properties.animation.play') }}
      </button>
      <button
        type="button"
        :class="toggleClass(false, !capabilities.pause)"
        :disabled="!capabilities.pause"
        @click="control('pause')"
      >
        {{ t('studio.properties.animation.pause') }}
      </button>
      <button
        type="button"
        :class="toggleClass(false, !capabilities.pause)"
        :disabled="!capabilities.pause"
        @click="control('stop')"
      >
        {{ t('studio.properties.animation.stop') }}
      </button>
      <button
        type="button"
        :class="toggleClass(false)"
        @click="control('restart')"
      >
        {{ t('studio.properties.animation.restart') }}
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
        v-if="menu === 'trigger'"
        :class="inspectorMenuPanelClass"
        :style="panelStyle"
      >
        <button
          v-for="trigger in triggerOptions"
          :key="trigger"
          type="button"
          :class="inspectorMenuItemClass(shownTrigger === trigger)"
          @click="pickTrigger(trigger)"
        >
          {{ t(`studio.properties.animation.triggers.${trigger}`) }}
        </button>
      </div>
      <div
        v-if="menu === 'end'"
        :class="inspectorMenuPanelClass"
        :style="panelStyle"
      >
        <button
          v-for="end in endOptions"
          :key="end"
          type="button"
          :class="inspectorMenuItemClass(source.endBehavior === end)"
          @click="pickEnd(end)"
        >
          {{ t(`studio.properties.animation.ends.${end}`) }}
        </button>
      </div>
    </Teleport>
  </div>
</template>
