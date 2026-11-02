import { peekAudioPreviewStream } from '../components/properties-inspector/audio-preview-stream';
import type { Scene } from '../models/scene.domain';
import { useStudioSessionStore } from '../store/studio-session.store';

type Probe = {
  elementId: string;
  analyser: AnalyserNode;
  stream?: MediaStream;
  audio?: HTMLAudioElement;
  ownsStream: boolean;
};

function levelFromAnalyser(analyser: AnalyserNode, samples: Uint8Array<ArrayBuffer>) {
  analyser.getByteTimeDomainData(samples);
  let sum = 0;
  for (const value of samples) {
    const sample = (value - 128) / 128;
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / samples.length);
  const db = rms > 0 ? 20 * Math.log10(rms) : -60;
  return Math.max(-60, Math.min(0, db));
}

export function useSceneAudioLevel(scene: Ref<Scene | undefined>) {
  const store = useStudioSessionStore();
  const levels = reactive<Record<string, number>>({});

  let context: AudioContext | undefined;
  let probes: Probe[] = [];
  let frame = 0;
  let generation = 0;

  function stopProbe(probe: Probe) {
    if (probe.ownsStream && probe.stream) {
      for (const track of probe.stream.getTracks()) {
        track.stop();
      }
    }
    if (probe.audio) {
      probe.audio.pause();
      probe.audio.src = '';
    }
  }

  function stop() {
    cancelAnimationFrame(frame);
    for (const probe of probes) {
      stopProbe(probe);
    }
    probes = [];
    if (context) {
      void context.close();
      context = undefined;
    }
  }

  async function openProbe(
    audioContext: AudioContext,
    elementId: string,
    elementSourceId: string,
  ): Promise<Probe | undefined> {
    const found = store.findSource(elementSourceId);
    const source = found.ok && found.value.type === 'audio' ? found.value : undefined;
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    if (source?.deviceId === 'system') {
      const held = peekAudioPreviewStream(source.id);
      if (!held) {
        return undefined;
      }
      const node = audioContext.createMediaStreamSource(held);
      node.connect(analyser);
      return { elementId, analyser, ownsStream: false };
    }

    if (source?.deviceId) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: source.deviceId } },
      });
      const node = audioContext.createMediaStreamSource(stream);
      node.connect(analyser);
      return { elementId, analyser, stream, ownsStream: true };
    }

    if (source?.assetId) {
      const asset = store.project?.assets.find((item) => item.id === source.assetId);
      if (asset?.location.kind !== 'remoteUrl') {
        return undefined;
      }
      const audio = new Audio(asset.location.url);
      audio.loop = true;
      const node = audioContext.createMediaElementSource(audio);
      node.connect(analyser);
      await audio.play().catch(() => undefined);
      return { elementId, analyser, audio, ownsStream: false };
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const node = audioContext.createMediaStreamSource(stream);
    node.connect(analyser);
    return { elementId, analyser, stream, ownsStream: true };
  }

  function tick() {
    const samples = new Uint8Array(2048);
    for (const probe of probes) {
      const peak = levelFromAnalyser(probe.analyser, samples);
      const previous = levels[probe.elementId] ?? -60;
      levels[probe.elementId] = peak > previous ? previous * 0.35 + peak * 0.65 : previous * 0.82 + peak * 0.18;
    }
    frame = requestAnimationFrame(tick);
  }

  async function start() {
    const token = ++generation;
    stop();
    for (const key of Object.keys(levels)) {
      Reflect.deleteProperty(levels, key);
    }
    const current = scene.value;
    const elements = current?.elements.filter((element) => element.type === 'audioVisual') ?? [];
    if (elements.length === 0) {
      return;
    }
    const audioContext = new AudioContext();
    context = audioContext;
    const next: Probe[] = [];
    for (const element of elements) {
      if (token !== generation) {
        return;
      }
      try {
        const probe = await openProbe(audioContext, element.id, element.sourceId);
        if (token !== generation) {
          if (probe) {
            stopProbe(probe);
          }
          return;
        }
        if (probe) {
          next.push(probe);
        }
      } catch {
        // A missing device leaves the name in its resting color.
      }
    }
    if (token !== generation) {
      return;
    }
    probes = next;
    if (probes.length === 0) {
      stop();
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  const signature = computed(() => {
    const current = scene.value;
    if (!current) {
      return '';
    }
    return current.elements
      .filter((element) => element.type === 'audioVisual')
      .map((element) => `${element.id}:${element.sourceId}`)
      .join('|');
  });

  watch(
    signature,
    () => {
      void start();
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    generation += 1;
    stop();
  });

  return { levels };
}
