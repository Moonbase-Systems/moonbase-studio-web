<script setup lang="ts">
import { cn } from '~/utils/index';

import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import { useStudioAudioDevices } from '../../../composables/useStudioAudioDevices';
import type { AudioInputView } from '../../../infrastructure/audio/audio-devices';
import { captureSystemAudio } from '../../../infrastructure/audio/raw-capture';
import type { ChannelId, SceneId } from '../../../models/ids.domain';
import type { AudioVisualElement } from '../../../models/scene-elements';
import type { AudioSource } from '../../../models/source.domain';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import {
  inspectorChevronClass,
  inspectorFieldShellClass,
  inspectorLabelClass,
  inspectorMenuItemClass,
  inspectorMenuPanelClass,
  inspectorRowClass,
} from '../inspector-control-classes';
import InspectorMarqueeLabel from '../InspectorMarqueeLabel.vue';

const props = defineProps<{
  channelId: ChannelId;
  sceneId?: SceneId;
  element?: AudioVisualElement;
}>();

const { t } = useI18n();
const store = useStudioSessionStore();
const devices = useStudioAudioDevices();
const { applyUpdate } = useElementInspectorUpdate();

const channel = computed(() => store.project?.audioMixer.channels.find((item) => item.id === props.channelId));
const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const panelStyle = ref<Record<string, string>>({});

const channelSources = computed(() => {
  const ids = new Set(channel.value?.sourceIds ?? []);
  return (store.project?.sources.filter((source) => source.type === 'audio' && ids.has(source.id)) ??
    []) as AudioSource[];
});

const buttonLabel = computed(() => {
  const names = channelSources.value.map((source) => source.name).filter((name) => name.trim().length > 0);
  return names.join(', ') || t('studio.properties.labels.microphones');
});

const selectedDeviceIds = computed(
  () => new Set(channelSources.value.map((source) => source.deviceId).filter((id): id is string => Boolean(id))),
);

const statusKey = {
  available: 'studio.audio.status.available',
  active: 'studio.audio.status.active',
  disconnected: 'studio.audio.status.disconnected',
  'start-error': 'studio.audio.status.startError',
} as const;

const hasDisconnected = computed(() => devices.snapshot.inputs.some((device) => device.status === 'disconnected'));

const statusMessage = computed(() => {
  if (devices.snapshot.permission === 'denied') {
    return t('studio.audio.permissionDenied');
  }
  if (hasDisconnected.value) {
    return t('studio.audio.disconnectedKept');
  }
  if (devices.systemEnded) {
    return t('studio.audio.systemEnded');
  }
  return '';
});

function placePanel() {
  const trigger = triggerRef.value;
  if (!trigger) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const width = 240;
  const left = Math.min(rect.left, window.innerWidth - width - 8);
  panelStyle.value = {
    left: `${Math.max(8, left)}px`,
    bottom: `${window.innerHeight - rect.top + 4}px`,
    maxHeight: `${Math.max(120, rect.top - 12)}px`,
  };
}

async function togglePanel() {
  if (!open.value) {
    placePanel();
    if (devices.snapshot.labelsHidden || devices.snapshot.permission !== 'granted') {
      try {
        await devices.revealLabels();
      } catch {
        // A denied probe stays on the session as permission denied.
      }
    }
  }
  open.value = !open.value;
}

function deviceLabel(device: AudioInputView): string {
  return device.named ? device.label : t('studio.audio.unnamedDevice');
}

function ensureOnChannel(sourceId: string) {
  const current = channel.value;
  const project = store.project;
  if (!current || !project) {
    return;
  }
  const owner = project.audioMixer.channels.find((item) => item.sourceIds.includes(sourceId));
  if (owner && owner.id !== current.id) {
    if (props.element && props.sceneId) {
      applyUpdate(props.sceneId, props.element.id, { channelId: owner.id });
      return;
    }
    if (!owner.global) {
      store.updateAudioChannel(owner.id, { global: true });
    }
    store.selectGlobalChannel(owner.id);
    return;
  }
  if (!owner) {
    store.assignAudioSource(current.id, sourceId);
  }
}

async function attachSource(sourceId: string, deviceId: string) {
  ensureOnChannel(sourceId);
  if (deviceId === 'system') {
    return;
  }
  const active = devices.snapshot.inputs.some((device) => device.deviceId === deviceId && device.status === 'active');
  if (!active) {
    try {
      await devices.startMicrophone(sourceId, deviceId);
    } catch {
      // The session already records permission denied or a start error.
    }
  }
}

async function pickDevice(device: AudioInputView) {
  const project = store.project;
  if (!project) {
    return;
  }
  const existing = project.sources.find(
    (source): source is AudioSource => source.type === 'audio' && source.deviceId === device.deviceId,
  );
  if (existing) {
    await attachSource(existing.id, device.deviceId);
    open.value = false;
    return;
  }
  const added = store.addSource({
    type: 'audio',
    name: deviceLabel(device),
    deviceId: device.deviceId,
  });
  if (!added.ok) {
    return;
  }
  const created = store.project?.sources.find(
    (source): source is AudioSource => source.type === 'audio' && source.deviceId === device.deviceId,
  );
  if (created) {
    await attachSource(created.id, device.deviceId);
  }
  open.value = false;
}

async function pickSystem() {
  const stream = await captureSystemAudio();
  if (!stream) {
    return;
  }
  const project = store.project;
  const existing = project?.sources.find(
    (source): source is AudioSource => source.type === 'audio' && source.deviceId === 'system',
  );
  if (existing) {
    devices.armSystemStream(existing.id, stream);
    ensureOnChannel(existing.id);
    open.value = false;
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
  const created = store.project?.sources.find(
    (source): source is AudioSource => source.type === 'audio' && source.deviceId === 'system',
  );
  if (!created) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return;
  }
  devices.armSystemStream(created.id, stream);
  ensureOnChannel(created.id);
  open.value = false;
}
</script>

<template>
  <div :class="inspectorRowClass">
    <span :class="inspectorLabelClass">{{ t('studio.properties.labels.source') }}</span>
    <button
      ref="triggerRef"
      type="button"
      :class="cn(inspectorFieldShellClass, 'max-w-[180px] overflow-hidden')"
      :aria-expanded="open"
      @click="togglePanel"
    >
      <span class="min-w-0 flex-1 truncate text-left">{{ buttonLabel }}</span>
      <span :class="cn(inspectorChevronClass, open && 'rotate-180')"> &gt; </span>
    </button>
  </div>
  <p
    v-if="statusMessage"
    role="status"
    aria-atomic="true"
    class="text-body-sm text-on-surface font-sans"
  >
    {{ statusMessage }}
  </p>

  <Teleport to="body">
    <button
      v-if="open"
      type="button"
      class="fixed inset-0 z-40 cursor-default bg-transparent"
      :aria-label="t('studio.document.cancel')"
      @click="open = false"
    />
    <div
      v-if="open"
      :class="cn(inspectorMenuPanelClass, 'w-[240px] overflow-y-auto overflow-x-hidden')"
      :style="panelStyle"
      @keydown.esc="open = false"
    >
      <p
        v-if="devices.snapshot.labelsHidden"
        class="text-body-sm text-on-surface px-xxx-sm font-sans"
      >
        {{ t('studio.audio.namesHidden') }}
      </p>
      <p
        v-if="devices.snapshot.inputs.length === 0"
        class="text-body-sm text-on-surface-dim px-xxx-sm font-sans"
      >
        {{ t('studio.audio.noInputs') }}
      </p>
      <p :class="cn(inspectorLabelClass, 'px-xxx-sm py-tiny')">
        {{ t('studio.properties.labels.microphones') }}
      </p>
      <button
        v-for="device in devices.snapshot.inputs"
        :key="device.deviceId"
        type="button"
        :class="cn(inspectorMenuItemClass(selectedDeviceIds.has(device.deviceId)), 'group overflow-hidden')"
        @click="pickDevice(device)"
      >
        <InspectorMarqueeLabel :label="`${deviceLabel(device)} · ${t(statusKey[device.status])}`" />
      </button>
      <button
        type="button"
        :class="cn(inspectorMenuItemClass(selectedDeviceIds.has('system')), 'group overflow-hidden')"
        @click="pickSystem"
      >
        <InspectorMarqueeLabel :label="t('studio.properties.labels.systemSource')" />
      </button>
    </div>
  </Teleport>
</template>
