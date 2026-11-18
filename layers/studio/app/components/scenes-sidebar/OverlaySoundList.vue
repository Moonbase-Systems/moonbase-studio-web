<script setup lang="ts">
import { useStudioAudioDevices } from '../../composables/useStudioAudioDevices';
import type { AudioInputView } from '../../infrastructure/audio/audio-devices';
import { holdOverlayAssetUrl } from '../../infrastructure/audio/overlay-asset-url';
import type { AssetId, ChannelId, SourceId } from '../../models/ids.domain';
import type { AudioSource } from '../../models/source.domain';
import { useStudioSessionStore } from '../../store/studio-session.store';
import { inspectorFocusRingClass, inspectorToggleClass } from '../properties-inspector/inspector-control-classes';
import SceneListRow from '../scene-element-list/SceneListRow.vue';

const store = useStudioSessionStore();
const devices = useStudioAudioDevices();
const { t } = useI18n();

const adding = ref(false);
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

async function toggleAdding() {
  adding.value = !adding.value;
  if (!adding.value) {
    return;
  }
  if (devices.snapshot.labelsHidden || devices.snapshot.permission !== 'granted') {
    try {
      await devices.revealLabels();
    } catch {
      // A denied probe stays on the session as permission denied.
    }
  }
}

function selectCreatedSound() {
  const id = store.project?.audioMixer.overlay.sounds.at(-1)?.id;
  if (id) {
    store.selectOverlaySound(id);
  }
  adding.value = false;
}

function selectGlobal(channelId: ChannelId) {
  store.selectGlobalChannel(channelId);
  adding.value = false;
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
  const name = deviceLabel(device).slice(0, 64);
  let source = sourceForDevice(device.deviceId);
  if (!source) {
    const added = store.addSource({ type: 'audio', name, deviceId: device.deviceId });
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
  publishSource(source.id, name);
}

async function addSystemAudio() {
  if (!navigator.mediaDevices?.getDisplayMedia || !store.project) {
    return;
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
  } catch {
    return;
  }
  for (const track of stream.getVideoTracks()) {
    track.stop();
  }
  if (stream.getAudioTracks().length === 0) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
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
  <section class="border-line pt-md flex max-h-[50%] min-h-[24rem] shrink-0 flex-col border-t">
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
      class="flex min-h-0 flex-1 flex-col overflow-y-auto"
      role="listbox"
      :aria-label="t('studio.audio.overlay.globalSounds')"
    >
      <div
        v-if="adding"
        class="gap-xxx-sm py-xxx-sm flex flex-wrap"
      >
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="fileInput?.click()"
        >
          {{ t('studio.audio.overlay.file') }}
        </button>
        <button
          v-for="asset in audioAssets"
          :key="asset.id"
          type="button"
          :class="inspectorToggleClass(false)"
          class="max-w-full truncate"
          @click="addFromAsset(asset.id, asset.name)"
        >
          {{ asset.name }}
        </button>
        <button
          v-for="device in devices.snapshot.inputs"
          :key="device.deviceId"
          type="button"
          :class="inspectorToggleClass(false)"
          class="max-w-full truncate"
          @click="addMicrophone(device)"
        >
          {{ deviceLabel(device) }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="addSystemAudio"
        >
          {{ t('studio.audio.overlay.systemAudio') }}
        </button>
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
        :class="inspectorFocusRingClass"
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
        :class="inspectorFocusRingClass"
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
