<script setup lang="ts">
import { useElementInspectorUpdate } from '../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../models/ids.domain';
import type { AudioVisualElement } from '../../models/scene-elements';
import { useStudioSessionStore } from '../../store/studio-session.store';
import { peekAudioPreviewStream } from './audio-preview-stream';
import AudioLevelMeter from './AudioLevelMeter.vue';
import AudioVolumeSlider from './AudioVolumeSlider.vue';

const props = defineProps<{
  sceneId: SceneId;
  element: AudioVisualElement;
}>();

const store = useStudioSessionStore();
const { updateSettings } = useElementInspectorUpdate();

const levelDb = ref(-60);

const linkedSource = computed(() => {
  const result = store.findSource(props.element.sourceId);
  return result.ok && result.value.type === 'audio' ? result.value : undefined;
});

let context: AudioContext | undefined;
let analyser: AnalyserNode | undefined;
let monitorGain: GainNode | undefined;
let monitorPan: StereoPannerNode | undefined;
let ownedStream: MediaStream | undefined;
let fileElement: HTMLAudioElement | undefined;
let frame = 0;

function syncMonitor() {
  if (!context || !monitorGain) {
    return;
  }
  const { monitoring, muted, volume, gainDb } = props.element.settings;
  const audible = monitoring !== 'off' && !muted;
  const linear = Math.min(4, Math.max(0, volume * 10 ** (gainDb / 20)));
  monitorGain.gain.value = audible ? linear : 0;
  if (monitorPan) {
    monitorPan.pan.value = props.element.settings.pan;
  }
  if (audible && context.state === 'suspended') {
    void context.resume();
  }
}

function attachMonitor(input: AudioNode) {
  if (!context) {
    return;
  }
  monitorGain = context.createGain();
  monitorGain.gain.value = 0;
  monitorPan = context.createStereoPanner();
  input.connect(monitorGain);
  monitorGain.connect(monitorPan);
  monitorPan.connect(context.destination);
  syncMonitor();
}

function stopMeter() {
  cancelAnimationFrame(frame);
  analyser = undefined;
  monitorGain = undefined;
  monitorPan = undefined;
  if (context) {
    void context.close();
    context = undefined;
  }
  if (ownedStream) {
    for (const track of ownedStream.getTracks()) {
      track.stop();
    }
    ownedStream = undefined;
  }
  if (fileElement) {
    fileElement.pause();
    fileElement.src = '';
    fileElement = undefined;
  }
}

async function connectStream(stream: MediaStream, ownsStream: boolean) {
  stopMeter();
  if (ownsStream) {
    ownedStream = stream;
  }
  const audioContext = new AudioContext();
  context = audioContext;
  const source = audioContext.createMediaStreamSource(stream);
  const nextAnalyser = audioContext.createAnalyser();
  nextAnalyser.fftSize = 2048;
  source.connect(nextAnalyser);
  analyser = nextAnalyser;
  attachMonitor(nextAnalyser);
  const samples = new Uint8Array(nextAnalyser.fftSize);
  const tick = () => {
    const current = analyser;
    if (!current) {
      return;
    }
    current.getByteTimeDomainData(samples);
    let sum = 0;
    for (const value of samples) {
      const sample = (value - 128) / 128;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / samples.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -60;
    levelDb.value = Math.max(-60, Math.min(0, db));
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}

async function connectFile(url: string) {
  stopMeter();
  const audio = new Audio(url);
  audio.loop = true;
  fileElement = audio;
  const audioContext = new AudioContext();
  context = audioContext;
  const source = audioContext.createMediaElementSource(audio);
  startFromNode(source);
  await audio.play().catch(() => {
    levelDb.value = -60;
  });
}

function startFromNode(node: AudioNode) {
  if (!context) {
    return;
  }
  const nextAnalyser = context.createAnalyser();
  nextAnalyser.fftSize = 2048;
  node.connect(nextAnalyser);
  analyser = nextAnalyser;
  attachMonitor(nextAnalyser);
  const samples = new Uint8Array(nextAnalyser.fftSize);
  const tick = () => {
    const current = analyser;
    if (!current) {
      return;
    }
    current.getByteTimeDomainData(samples);
    let sum = 0;
    for (const value of samples) {
      const sample = (value - 128) / 128;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / samples.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -60;
    levelDb.value = Math.max(-60, Math.min(0, db));
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}

async function connect() {
  stopMeter();
  levelDb.value = -60;
  const source = linkedSource.value;
  try {
    if (source?.deviceId === 'system') {
      const held = peekAudioPreviewStream(source.id);
      if (held) {
        await connectStream(held, false);
      }
      return;
    }
    if (source?.deviceId) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: source.deviceId } },
      });
      await connectStream(stream, true);
      return;
    }
    if (source?.assetId) {
      const asset = store.project?.assets.find((item) => item.id === source.assetId);
      if (asset?.location.kind === 'remoteUrl') {
        await connectFile(asset.location.url);
      }
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await connectStream(stream, true);
  } catch {
    levelDb.value = -60;
  }
}

watch(
  () => [linkedSource.value?.id, linkedSource.value?.deviceId, linkedSource.value?.assetId] as const,
  () => {
    void connect();
  },
  { immediate: true },
);

watch(
  () =>
    [
      props.element.settings.monitoring,
      props.element.settings.muted,
      props.element.settings.volume,
      props.element.settings.gainDb,
      props.element.settings.pan,
    ] as const,
  () => {
    syncMonitor();
  },
);

onBeforeUnmount(() => {
  stopMeter();
});

function setVolume(volume: number) {
  updateSettings(props.sceneId, props.element, { volume });
}
</script>

<template>
  <div class="gap-md flex w-full max-w-[280px] flex-col items-center">
    <AudioLevelMeter :level-db="levelDb" />
    <AudioVolumeSlider
      :model-value="element.settings.volume"
      @change="setVolume"
    />
  </div>
</template>
