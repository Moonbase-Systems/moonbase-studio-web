<script setup lang="ts">
import { cn } from '~/utils/index';

import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import { useStudioAudioEngine } from '../../../composables/useStudioAudioEngine';
import { rawMicrophoneConstraints } from '../../../infrastructure/audio/audio-engine';
import {
  type AudioMonitoringMode,
  FADER_DB_MAX,
  FADER_DB_MIN,
  SYNC_OFFSET_MS_MAX,
  SYNC_OFFSET_MS_MIN,
  TRIM_DB_MAX,
  TRIM_DB_MIN,
} from '../../../models/audio.domain';
import type { SceneId } from '../../../models/ids.domain';
import type { AudioVisualElement } from '../../../models/scene-elements';
import type { AudioSource } from '../../../models/source.domain';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import AudioBalanceSlider from '../AudioBalanceSlider.vue';
import AudioVolumeSlider from '../AudioVolumeSlider.vue';
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
const audioEngine = useStudioAudioEngine();
const { applyUpdate } = useElementInspectorUpdate();

const open = ref(false);
const advancedOpen = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const panelStyle = ref<Record<string, string>>({ left: '0px', bottom: '0px', maxHeight: '240px' });
const inputs = ref<MediaDeviceInfo[]>([]);

const textControlClass = inspectorControlTextClass;
const labelClass = inspectorLabelClass;
const rowClass = inspectorRowClass;
const fieldShellClass = cn(inspectorFieldShellClass, 'min-w-[120px]');

const channel = computed(() => store.project?.audioMixer.channels.find((item) => item.id === props.element.channelId));

const channelSources = computed(() => {
  const ids = new Set(channel.value?.sourceIds ?? []);
  return (store.project?.sources.filter((source) => source.type === 'audio' && ids.has(source.id)) ??
    []) as AudioSource[];
});

const linkedSource = computed(() => channelSources.value[0]);

const audioSources = computed(() => store.project?.sources.filter((source) => source.type === 'audio') ?? []);

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
      const probe = await navigator.mediaDevices.getUserMedia({ audio: rawMicrophoneConstraints() });
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

function patchChannel(changes: Parameters<typeof store.updateAudioChannel>[1]) {
  const current = channel.value;
  if (!current) {
    return;
  }
  store.updateAudioChannel(current.id, changes);
}

async function armSource(source: AudioSource) {
  if (!source.deviceId || source.deviceId === 'system' || audioEngine.hasArmed(source.id)) {
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return;
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: rawMicrophoneConstraints(source.deviceId),
  });
  audioEngine.armStream(source.id, stream);
}

function selectSource(sourceId: string) {
  const current = channel.value;
  const project = store.project;
  if (!current || !project) {
    return;
  }
  const owner = project.audioMixer.channels.find((item) => item.sourceIds.includes(sourceId));
  if (owner && owner.id !== current.id) {
    applyUpdate(props.sceneId, props.element.id, { channelId: owner.id });
  } else if (!owner) {
    store.assignAudioSource(current.id, sourceId);
  }
  const source = project.sources.find((item) => item.id === sourceId);
  if (source?.type === 'audio') {
    void armSource(source);
  }
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
      audioEngine.armStream(existing.id, stream);
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
    audioEngine.armStream(created.id, stream);
    selectSource(created.id);
  } catch {
    open.value = false;
  }
}

function commitFader(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  patchChannel({ faderDb: Math.min(FADER_DB_MAX, Math.max(FADER_DB_MIN, value)) });
}

function setFader(faderDb: number) {
  patchChannel({ faderDb });
}

function commitGain(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  patchChannel({ trimDb: Math.min(TRIM_DB_MAX, Math.max(TRIM_DB_MIN, value)) });
}

function setPan(pan: number) {
  patchChannel({ pan });
}

function commitPan(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  patchChannel({ pan: Math.min(1, Math.max(-1, value / 100)) });
}

function commitOffset(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  patchChannel({
    syncOffsetMs: Math.min(SYNC_OFFSET_MS_MAX, Math.max(SYNC_OFFSET_MS_MIN, Math.round(value))),
  });
}

function cycleMonitoring() {
  const order: AudioMonitoringMode[] = ['off', 'monitor', 'monitor-and-output'];
  const current = channel.value?.monitoring ?? 'off';
  const next = order[(order.indexOf(current) + 1) % order.length] ?? 'off';
  patchChannel({ monitoring: next });
}

async function startFile() {
  const source = channelSources.value.find((item) => item.assetId);
  if (!source?.assetId) {
    return;
  }
  const asset = store.project?.assets.find((item) => item.id === source.assetId);
  if (asset?.location.kind !== 'remoteUrl') {
    return;
  }
  await audioEngine.armFile(source.id, asset.location.url);
}

function removeGroupedSource(sourceId: string) {
  const current = channel.value;
  if (!current) {
    return;
  }
  store.removeAudioSource(current.id, sourceId);
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
        <span class="min-w-0 flex-1 truncate text-left">{{
          channelSources.map((source) => source.name).join(', ') || channel?.name
        }}</span>
        <span :class="cn(inspectorChevronClass, open && 'rotate-180')"> &gt; </span>
      </button>
    </div>

    <div
      v-for="source in channelSources"
      :key="source.id"
      :class="rowClass"
    >
      <span :class="cn(labelClass, 'truncate')">{{ source.name }}</span>
      <button
        type="button"
        :class="decorationClass(false)"
        @click="removeGroupedSource(source.id)"
      >
        {{ t('studio.properties.labels.removeSource') }}
      </button>
    </div>

    <div :class="rowClass">
      <span :class="labelClass">{{ t('studio.properties.fields.volume') }}</span>
      <BaseScrubField
        compact
        label=" "
        field-suffix="horizontal"
        suffix="dB"
        field-class="w-[72px]"
        :model-value="channel?.faderDb ?? 0"
        :min="FADER_DB_MIN"
        :max="FADER_DB_MAX"
        :step="0.5"
        @change="commitFader"
      />
      <AudioVolumeSlider
        :model-value="channel?.faderDb ?? 0"
        @change="setFader"
      />
    </div>

    <div :class="rowClass">
      <button
        type="button"
        :class="decorationClass(channel?.muted === true)"
        :aria-pressed="channel?.muted === true"
        @click="patchChannel({ muted: !(channel?.muted ?? false) })"
      >
        {{ t('studio.properties.labels.mute') }}
      </button>
      <button
        type="button"
        :class="decorationClass(channel?.solo === true)"
        :aria-pressed="channel?.solo === true"
        @click="patchChannel({ solo: !(channel?.solo ?? false) })"
      >
        {{ t('studio.properties.labels.solo') }}
      </button>
      <button
        type="button"
        :class="decorationClass(channel?.monitoring !== 'off')"
        :aria-pressed="channel?.monitoring !== 'off'"
        @click="cycleMonitoring"
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
        <BaseScrubField
          compact
          label=" "
          field-suffix="horizontal"
          suffix="dB"
          field-class="w-[88px]"
          :model-value="channel?.trimDb ?? 0"
          :min="TRIM_DB_MIN"
          :max="TRIM_DB_MAX"
          :step="0.5"
          @change="commitGain"
        />
      </div>

      <div :class="rowClass">
        <span :class="labelClass">{{ t('studio.properties.labels.balance') }}</span>
        <BaseScrubField
          compact
          label=" "
          field-suffix="horizontal"
          field-class="w-[64px]"
          :model-value="Math.round((channel?.pan ?? 0) * 100)"
          :min="-100"
          :max="100"
          :step="1"
          @change="commitPan"
        />
        <AudioBalanceSlider
          :model-value="channel?.pan ?? 0"
          @change="setPan"
        />
      </div>

      <div :class="rowClass">
        <span :class="labelClass">{{ t('studio.properties.labels.offset') }}</span>
        <BaseScrubField
          compact
          label=" "
          field-suffix="horizontal"
          suffix="ms"
          field-class="w-[96px]"
          :model-value="channel?.syncOffsetMs ?? 0"
          :min="SYNC_OFFSET_MS_MIN"
          :max="SYNC_OFFSET_MS_MAX"
          :step="1"
          @change="commitOffset"
        />
      </div>
      <div
        v-if="channelSources.some((source) => source.assetId)"
        :class="rowClass"
      >
        <button
          type="button"
          :class="decorationClass(false)"
          @click="startFile"
        >
          {{ t('studio.properties.labels.startFile') }}
        </button>
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
