<script setup lang="ts">
import { cn } from '~/utils/index';

import { useStudioAudioDevices } from '../../composables/useStudioAudioDevices';
import type { AudioInputView } from '../../infrastructure/audio/audio-devices';
import { shortDeviceName } from '../../infrastructure/audio/device-label';
import { holdOverlayAssetUrl } from '../../infrastructure/audio/overlay-asset-url';
import { captureSystemAudio } from '../../infrastructure/audio/raw-capture';
import type { AssetId, ChannelId, SourceId } from '../../models/ids.domain';
import type { AudioSource } from '../../models/source.domain';
import { useStudioSessionStore } from '../../store/studio-session.store';
import {
  inspectorFocusRingClass,
  inspectorLabelClass,
  inspectorMenuItemClass,
  inspectorToggleClass,
} from '../properties-inspector/inspector-control-classes';
import SceneListRow from '../scene-element-list/SceneListRow.vue';

const store = useStudioSessionStore();
const devices = useStudioAudioDevices();
const { t } = useI18n();

const adding = ref(false);
const devicesOpen = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const sounds = computed(() => store.project?.audioMixer.overlay.sounds ?? []);
const globalChannels = computed(() => store.project?.audioMixer.channels.filter((channel) => channel.global) ?? []);
const audioAssets = computed(() => store.project?.assets.filter((asset) => asset.type === 'audio') ?? []);
const statusMessage = computed(() => {
  if (devices.snapshot.permission === 'denied') {
    return t('studio.audio.permissionDenied');
  }
  if (devices.systemEnded) {
    return t('studio.audio.systemEnded');
  }
  return '';
});

function soundNameFrom(raw: string) {
  const base = raw.replace(/\.[^.]+$/, '').trim();
  return (base || raw || t('studio.audio.overlay.sounds')).slice(0, 64);
}

function deviceLabel(device: AudioInputView) {
  return device.named ? device.label : t('studio.audio.unnamedDevice');
}

function closeAdding() {
  adding.value = false;
  devicesOpen.value = false;
}

async function toggleAdding() {
  if (adding.value) {
    closeAdding();
    return;
  }
  adding.value = true;
  if (devices.snapshot.labelsHidden || devices.snapshot.permission !== 'granted') {
    try {
      await devices.revealLabels();
    } catch {
      // A denied probe stays on the session as permission denied.
    }
  }
}

function toggleDevices() {
  devicesOpen.value = !devicesOpen.value;
}

function selectCreatedSound() {
  const id = store.project?.audioMixer.overlay.sounds.at(-1)?.id;
  if (id) {
    store.selectOverlaySound(id);
  }
  closeAdding();
}

function selectGlobal(channelId: ChannelId) {
  store.selectGlobalChannel(channelId);
  closeAdding();
}

function takenAudioNames() {
  const taken = new Set<string>();
  for (const source of store.project?.sources ?? []) {
    if (source.type === 'audio' && source.name.trim().length > 0) {
      taken.add(source.name.trim());
    }
  }
  for (const channel of store.project?.audioMixer.channels ?? []) {
    if (channel.name.trim().length > 0) {
      taken.add(channel.name.trim());
    }
  }
  return taken;
}

function addFromAsset(assetId: AssetId, name: string) {
  const added = store.addOverlaySound({ name: soundNameFrom(name), assetId });
  if (added.ok) {
    selectCreatedSound();
  }
}

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) {
    return;
  }
  const url = URL.createObjectURL(file);
  const added = store.addAsset({
    name: file.name,
    type: 'audio',
    location: { kind: 'storageKey', key: `local/${crypto.randomUUID?.() ?? `${Date.now()}-${file.name}`}` },
    availability: 'available',
    metadata: { mimeType: file.type || undefined, byteSize: file.size },
  });
  if (!added.ok) {
    URL.revokeObjectURL(url);
    return;
  }
  const asset = store.project?.assets.at(-1);
  if (!asset || asset.type !== 'audio') {
    URL.revokeObjectURL(url);
    return;
  }
  holdOverlayAssetUrl(asset.id, url);
  const sound = store.addOverlaySound({ name: soundNameFrom(file.name), assetId: asset.id });
  if (sound.ok) {
    selectCreatedSound();
  }
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}

function sourceForDevice(deviceId: string) {
  return store.project?.sources.find(
    (source): source is AudioSource => source.type === 'audio' && source.deviceId === deviceId,
  );
}

function publishSource(sourceId: SourceId, name: string) {
  const owner = store.project?.audioMixer.channels.find((channel) => channel.sourceIds.includes(sourceId));
  if (owner) {
    if (!owner.global) {
      store.updateAudioChannel(owner.id, { global: true });
    }
    selectGlobal(owner.id);
    return;
  }
  const added = store.addAudioChannel({ name, sourceIds: [sourceId], global: true });
  if (!added.ok) {
    return;
  }
  const created = store.project?.audioMixer.channels.find((channel) => channel.sourceIds.includes(sourceId));
  if (created) {
    selectGlobal(created.id);
  }
}

async function addMicrophone(device: AudioInputView) {
  const project = store.project;
  if (!project) {
    return;
  }
  let source = sourceForDevice(device.deviceId);
  if (!source) {
    const added = store.addSource({
      type: 'audio',
      name: shortDeviceName(deviceLabel(device), takenAudioNames()),
      deviceId: device.deviceId,
    });
    if (!added.ok) {
      return;
    }
    source = sourceForDevice(device.deviceId);
  }
  if (!source) {
    return;
  }
  const active = devices.snapshot.inputs.some((item) => item.deviceId === device.deviceId && item.status === 'active');
  if (!active) {
    try {
      await devices.startMicrophone(source.id, device.deviceId);
    } catch {
      // The session already records permission denied or a start error.
    }
  }
  publishSource(source.id, source.name);
}

async function addSystemAudio() {
  if (!store.project) {
    return;
  }
  const stream = await captureSystemAudio();
  if (!stream) {
    return;
  }
  const name = t('studio.audio.overlay.systemAudio');
  let source = sourceForDevice('system');
  if (!source) {
    const added = store.addSource({ type: 'audio', name, deviceId: 'system' });
    if (!added.ok) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      return;
    }
    source = sourceForDevice('system');
  }
  if (!source) {
    return;
  }
  devices.armSystemStream(source.id, stream);
  publishSource(source.id, name);
}

function removeGlobalChannel(channelId: ChannelId) {
  const project = store.project;
  const channel = project?.audioMixer.channels.find((item) => item.id === channelId);
  if (!project || !channel) {
    return;
  }
  const referenced = project.scenes.some((scene) =>
    scene.elements.some((element) => element.type === 'audioVisual' && element.channelId === channelId),
  );
  if (referenced) {
    store.updateAudioChannel(channelId, { global: false });
    return;
  }
  const sourceIds = [...channel.sourceIds];
  const removed = store.removeAudioChannel(channelId);
  if (!removed.ok) {
    return;
  }
  for (const sourceId of sourceIds) {
    store.removeSource(sourceId);
  }
}
</script>

<template>
  <section class="border-line pt-md flex max-h-[50%] min-h-[24rem] min-w-0 shrink-0 flex-col border-t">
    <div class="flex shrink-0 items-center justify-between">
      <h2 class="text-label text-on-surface-dim font-mono font-normal uppercase">
        {{ t('studio.audio.overlay.globalSounds') }}
      </h2>
      <BaseIconButton
        :label="t('studio.audio.overlay.addSound')"
        class="text-accent hover:text-accent-dim size-row"
        :aria-expanded="adding"
        @click="toggleAdding"
      >
        <IconPlus />
      </BaseIconButton>
    </div>

    <div
      class="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
      role="listbox"
      :aria-label="t('studio.audio.overlay.globalSounds')"
      @keydown.esc="devicesOpen = false"
    >
      <div
        v-if="adding"
        class="gap-xxx-sm py-xxx-sm flex w-full min-w-0 flex-col"
      >
        <button
          type="button"
          :class="cn(inspectorToggleClass(false), 'w-full min-w-0 justify-start')"
          @click="fileInput?.click()"
        >
          <span class="min-w-0 truncate">{{ t('studio.audio.overlay.file') }}</span>
        </button>
        <button
          type="button"
          :class="cn(inspectorToggleClass(false), 'w-full min-w-0 justify-start')"
          @click="addSystemAudio"
        >
          <span class="min-w-0 truncate">{{ t('studio.audio.overlay.systemAudio') }}</span>
        </button>
        <button
          type="button"
          :class="cn(inspectorToggleClass(devicesOpen), 'w-full min-w-0 justify-start')"
          :aria-expanded="devicesOpen"
          @click="toggleDevices"
        >
          <span class="min-w-0 flex-1 truncate text-left">{{ t('studio.properties.labels.microphones') }}</span>
        </button>
        <div
          v-if="devicesOpen"
          class="border-line bg-surface-container flex max-h-[12rem] w-full min-w-0 flex-col overflow-y-auto border"
          role="group"
          :aria-label="t('studio.properties.labels.microphones')"
        >
          <p :class="cn(inspectorLabelClass, 'bg-surface-container px-xxx-sm py-tiny sticky top-0')">
            {{ t('studio.properties.labels.microphones') }}
          </p>
          <p
            v-if="devices.snapshot.inputs.length === 0"
            class="text-body-sm text-on-surface-dim px-xxx-sm font-sans"
          >
            {{ t('studio.audio.noInputs') }}
          </p>
          <button
            v-for="device in devices.snapshot.inputs"
            :key="device.deviceId"
            type="button"
            :class="cn(inspectorMenuItemClass(false), 'w-full min-w-0')"
            @click="addMicrophone(device)"
          >
            <span class="min-w-0 flex-1 truncate text-left">{{ deviceLabel(device) }}</span>
          </button>
        </div>
        <div
          v-if="audioAssets.length > 0"
          class="flex w-full min-w-0 flex-col"
        >
          <p :class="cn(inspectorLabelClass, 'px-xxx-sm py-tiny')">
            {{ t('studio.audio.overlay.fromLibrary') }}
          </p>
          <button
            v-for="asset in audioAssets"
            :key="asset.id"
            type="button"
            :class="cn(inspectorMenuItemClass(false), 'w-full min-w-0')"
            @click="addFromAsset(asset.id, asset.name)"
          >
            <span class="min-w-0 flex-1 truncate text-left">{{ asset.name }}</span>
          </button>
        </div>
        <p
          v-if="statusMessage"
          class="text-body-sm text-on-surface-dim font-sans"
          role="status"
        >
          {{ statusMessage }}
        </p>
        <input
          ref="fileInput"
          type="file"
          accept="audio/*"
          class="sr-only"
          :aria-label="t('studio.audio.overlay.file')"
          @change="onFileChange"
        />
      </div>

      <div
        v-for="channel in globalChannels"
        :key="channel.id"
        role="option"
        tabindex="0"
        :aria-selected="store.selectedGlobalChannelId === channel.id"
        :class="cn(inspectorFocusRingClass, 'min-w-0')"
        @click="store.selectGlobalChannel(channel.id)"
        @keydown.enter.prevent="store.selectGlobalChannel(channel.id)"
        @keydown.space.prevent="store.selectGlobalChannel(channel.id)"
      >
        <SceneListRow
          :label="channel.name"
          :selected="store.selectedGlobalChannelId === channel.id"
          :delete-label="t('studio.audio.overlay.remove')"
          @delete="removeGlobalChannel(channel.id)"
        />
      </div>
      <div
        v-for="sound in sounds"
        :key="sound.id"
        role="option"
        tabindex="0"
        :aria-selected="store.selectedOverlaySoundId === sound.id"
        :class="cn(inspectorFocusRingClass, 'min-w-0')"
        @click="store.selectOverlaySound(sound.id)"
        @keydown.enter.prevent="store.selectOverlaySound(sound.id)"
        @keydown.space.prevent="store.selectOverlaySound(sound.id)"
      >
        <SceneListRow
          :label="sound.name"
          :selected="store.selectedOverlaySoundId === sound.id"
          :delete-label="t('studio.audio.overlay.remove')"
          @delete="store.removeOverlaySound(sound.id)"
        />
      </div>
    </div>
  </section>
</template>
