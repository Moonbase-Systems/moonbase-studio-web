<script setup lang="ts">
import { cn } from '~/utils/index';

import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import type { AudioVisualElement } from '../../../models/scene-elements';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import { holdAudioPreviewStream } from '../audio-preview-stream';
import AudioBalanceSlider from '../AudioBalanceSlider.vue';
import {
  inspectorChevronClass,
  inspectorControlTextClass,
  inspectorFieldShellClass,
  inspectorFocusRingClass,
  inspectorLabelClass,
  inspectorMenuItemClass,
  inspectorMenuPanelClass,
  inspectorRowClass,
  inspectorToggleClass,
} from '../inspector-control-classes';
import InspectorMarqueeLabel from '../InspectorMarqueeLabel.vue';

const props = defineProps<{
  sceneId: SceneId;
  element: AudioVisualElement;
}>();

const { t } = useI18n();
const store = useStudioSessionStore();
const { applyUpdate, updateSettings } = useElementInspectorUpdate();

const open = ref(false);
const advancedOpen = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const panelStyle = ref<Record<string, string>>({ left: '0px', bottom: '0px', maxHeight: '240px' });
const inputs = ref<MediaDeviceInfo[]>([]);
const volumeUnit = ref<'percent' | 'db'>('percent');

const textControlClass = inspectorControlTextClass;
const labelClass = inspectorLabelClass;
const rowClass = inspectorRowClass;
const fieldShellClass = cn(inspectorFieldShellClass, 'min-w-[120px]');

const linkedSource = computed(() => {
  const result = store.findSource(props.element.sourceId);
  return result.ok && result.value.type === 'audio' ? result.value : undefined;
});

const audioSources = computed(() => store.project?.sources.filter((source) => source.type === 'audio') ?? []);

const volumeDraft = computed(() => {
  const volume = props.element.settings.volume;
  if (volumeUnit.value === 'percent') {
    return Math.round(volume * 100);
  }
  if (volume <= 0) {
    return -60;
  }
  return Math.round(Math.max(-60, 20 * Math.log10(volume)));
});

function placePanel() {
  const trigger = triggerRef.value;
  if (!trigger) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const width = 240;
  const left = Math.min(rect.left, window.innerWidth - width - 8);
  const spaceAbove = Math.max(120, rect.top - 12);
  panelStyle.value = {
    left: `${Math.max(8, left)}px`,
    bottom: `${window.innerHeight - rect.top + 4}px`,
    maxHeight: `${spaceAbove}px`,
  };
}

async function refreshInputs() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    inputs.value = [];
    return;
  }
  try {
    let devices = await navigator.mediaDevices.enumerateDevices();
    let microphones = devices.filter((device) => device.kind === 'audioinput');
    if (microphones.some((device) => device.label === '') && navigator.mediaDevices.getUserMedia) {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of probe.getTracks()) {
        track.stop();
      }
      devices = await navigator.mediaDevices.enumerateDevices();
      microphones = devices.filter((device) => device.kind === 'audioinput');
    }
    inputs.value = microphones;
  } catch {
    inputs.value = [];
  }
}

async function togglePanel() {
  if (!open.value) {
    placePanel();
    await refreshInputs();
  }
  open.value = !open.value;
}

function selectSource(sourceId: string) {
  applyUpdate(props.sceneId, props.element.id, { sourceId });
  open.value = false;
}

function pickDevice(device: MediaDeviceInfo) {
  const existing = audioSources.value.find((source) => source.deviceId === device.deviceId);
  if (existing) {
    selectSource(existing.id);
    return;
  }
  const added = store.addSource({
    type: 'audio',
    name: device.label || t('studio.properties.labels.microphones'),
    deviceId: device.deviceId,
  });
  if (!added.ok) {
    return;
  }
  const created = store.project?.sources.find(
    (source) => source.type === 'audio' && source.deviceId === device.deviceId,
  );
  if (created) {
    selectSource(created.id);
  }
}

async function pickSystem() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
    for (const track of stream.getVideoTracks()) {
      track.stop();
    }
    const existing = audioSources.value.find((source) => source.deviceId === 'system');
    if (existing) {
      holdAudioPreviewStream(existing.id, stream);
      selectSource(existing.id);
      return;
    }
    const added = store.addSource({
      type: 'audio',
      name: t('studio.properties.labels.systemSource'),
      deviceId: 'system',
    });
    if (!added.ok) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      return;
    }
    const created = store.project?.sources.find((source) => source.type === 'audio' && source.deviceId === 'system');
    if (!created) {
      return;
    }
    holdAudioPreviewStream(created.id, stream);
    selectSource(created.id);
  } catch {
    open.value = false;
  }
}

function commitVolume(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  if (volumeUnit.value === 'percent') {
    updateSettings(props.sceneId, props.element, { volume: Math.min(1, Math.max(0, value / 100)) });
    return;
  }
  const db = Math.min(0, Math.max(-60, value));
  const volume = db <= -60 ? 0 : Math.min(1, 10 ** (db / 20));
  updateSettings(props.sceneId, props.element, { volume });
}

function commitGain(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  updateSettings(props.sceneId, props.element, { gainDb: Math.min(24, Math.max(-24, value)) });
}

function setPan(pan: number) {
  updateSettings(props.sceneId, props.element, { pan });
}

function commitPan(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  updateSettings(props.sceneId, props.element, { pan: Math.min(1, Math.max(-1, value / 100)) });
}

function commitOffset(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  updateSettings(props.sceneId, props.element, { syncOffsetMs: value });
}

function decorationClass(active: boolean) {
  return inspectorToggleClass(active);
}
</script>

<template>
  <div class="gap-xxx-sm flex w-full min-w-0 flex-col items-stretch">
    <div :class="rowClass">
      <span :class="labelClass">{{ t('studio.properties.labels.source') }}</span>
      <button
        ref="triggerRef"
        type="button"
        :class="cn(fieldShellClass, 'max-w-[180px] overflow-hidden')"
        :aria-expanded="open"
        @click="togglePanel"
      >
        <span class="min-w-0 flex-1 truncate text-left">{{ linkedSource?.name ?? element.sourceId }}</span>
        <span :class="cn(inspectorChevronClass, open && 'rotate-180')"> &gt; </span>
      </button>
    </div>

    <div :class="rowClass">
      <span :class="labelClass">{{ t('studio.properties.fields.volume') }}</span>
      <BaseInspectorField
        :model-value="volumeDraft"
        :suffix="volumeUnit === 'percent' ? '%' : 'dB'"
        class="w-[72px]"
        @change="commitVolume"
      />
      <button
        type="button"
        :class="decorationClass(volumeUnit === 'percent')"
        @click="volumeUnit = 'percent'"
      >
        %
      </button>
      <button
        type="button"
        :class="decorationClass(volumeUnit === 'db')"
        @click="volumeUnit = 'db'"
      >
        dB
      </button>
    </div>

    <div :class="rowClass">
      <button
        type="button"
        :class="decorationClass(element.settings.muted)"
        :aria-pressed="element.settings.muted"
        @click="updateSettings(sceneId, element, { muted: !element.settings.muted })"
      >
        {{ t('studio.properties.labels.mute') }}
      </button>
      <button
        type="button"
        :class="decorationClass(element.settings.monitoring !== 'off')"
        :aria-pressed="element.settings.monitoring !== 'off'"
        @click="
          updateSettings(sceneId, element, {
            monitoring: element.settings.monitoring === 'off' ? 'monitor' : 'off',
          })
        "
      >
        {{ t('studio.properties.labels.monitor') }}
      </button>
    </div>

    <button
      type="button"
      :class="
        cn(textControlClass, 'h-row gap-xxx-sm px-xxx-sm hover:text-accent flex items-center', inspectorFocusRingClass)
      "
      :aria-expanded="advancedOpen"
      @click="advancedOpen = !advancedOpen"
    >
      {{ t('studio.properties.labels.advanced') }}
      <span :class="cn(inspectorChevronClass, advancedOpen && 'rotate-90')"> &gt; </span>
    </button>

    <template v-if="advancedOpen">
      <div :class="rowClass">
        <span :class="labelClass">{{ t('studio.properties.labels.gain') }}</span>
        <BaseInspectorField
          :model-value="element.settings.gainDb"
          suffix="dB"
          class="w-[72px]"
          @change="commitGain"
        />
      </div>

      <div :class="rowClass">
        <span :class="labelClass">{{ t('studio.properties.labels.balance') }}</span>
        <BaseInspectorField
          :model-value="Math.round(element.settings.pan * 100)"
          class="w-[64px]"
          @change="commitPan"
        />
        <AudioBalanceSlider
          :model-value="element.settings.pan"
          @change="setPan"
        />
      </div>

      <div :class="rowClass">
        <span :class="labelClass">{{ t('studio.properties.labels.offset') }}</span>
        <BaseInspectorField
          :model-value="element.settings.syncOffsetMs"
          suffix="ms"
          class="w-[88px]"
          @change="commitOffset"
        />
      </div>
    </template>

    <Teleport to="body">
      <button
        v-if="open"
        type="button"
        class="fixed inset-0 z-40 cursor-default bg-transparent"
        aria-label="close"
        @click="open = false"
      />
      <div
        v-if="open"
        :class="cn(inspectorMenuPanelClass, 'w-[240px] overflow-y-auto overflow-x-hidden')"
        :style="panelStyle"
      >
        <p
          v-if="inputs.length === 0"
          :class="cn(textControlClass, 'px-xxx-sm text-on-surface-dim')"
        >
          {{ t('studio.properties.noAudioSources') }}
        </p>
        <p :class="cn(labelClass, 'px-xxx-sm py-tiny')">
          {{ t('studio.properties.labels.microphones') }}
        </p>
        <button
          v-for="device in inputs"
          :key="device.deviceId"
          type="button"
          :class="cn(inspectorMenuItemClass(device.deviceId === linkedSource?.deviceId), 'group overflow-hidden')"
          @click="pickDevice(device)"
        >
          <InspectorMarqueeLabel :label="device.label || device.deviceId" />
        </button>
        <button
          type="button"
          :class="cn(inspectorMenuItemClass(), 'group overflow-hidden')"
          @click="pickSystem"
        >
          <InspectorMarqueeLabel :label="t('studio.properties.labels.systemSource')" />
        </button>
      </div>
    </Teleport>
  </div>
</template>
