import type { InjectionKey } from 'vue';
import { inject, onMounted, onScopeDispose, provide, reactive, watch } from 'vue';

import {
  AudioEngine,
  type AudioGraphSnapshot,
  type AudioLevels,
  emptyAudioLevels,
  type MonitorSinkResult,
  type OverlayInstanceStart,
} from '../infrastructure/audio/audio-engine';
import { type AudioEffect, channelAudibleInScene } from '../models/audio.domain';
import { createDefaultOverlayBus } from '../models/overlay-sound.domain';
import { useStudioSessionStore } from '../store/studio-session.store';

export type StudioAudioEngineHandle = {
  levels: AudioLevels;
  armStream: (sourceId: string, stream: MediaStream, release?: () => void) => void;
  armFile: (sourceId: string, url: string) => Promise<void>;
  hasArmed: (sourceId: string) => boolean;
  getProgramStream: () => MediaStream | null;
  readProgramFrequency: (bins: Uint8Array) => boolean;
  readCurve: (effect: AudioEffect) => { frequencies: number[]; magnitudeDb: number[] } | null;
  setMonitorSink: (sinkId: string) => Promise<MonitorSinkResult>;
  loadOverlayBuffer: (cacheKey: string, url: string) => Promise<AudioBuffer>;
  retainOverlayBuffers: (keep: ReadonlySet<string>) => void;
  startOverlayInstance: (request: OverlayInstanceStart) => void;
  stopOverlayInstance: (instanceId: string) => void;
  setOverlayInstanceGain: (instanceId: string, volumeDb: number, muted: boolean) => void;
  setOverlayEndedListener: (listener: ((instanceId: string) => void) | null) => void;
};

const StudioAudioEngineKey: InjectionKey<StudioAudioEngineHandle> = Symbol('studio-audio-engine');

const snapshotFromStore = (
  project: NonNullable<ReturnType<typeof useStudioSessionStore>['project']>,
  activeSceneId: string | null,
): AudioGraphSnapshot => {
  const scene = project.scenes.find((item) => item.id === activeSceneId);
  const enabled = new Set<string>();
  for (const element of scene?.elements ?? []) {
    if (element.type === 'audioVisual' && element.visibility) {
      enabled.add(element.channelId);
    }
  }
  return {
    master: {
      volume: project.audioMixer.master.volume,
      muted: project.audioMixer.master.muted,
      effects: project.audioMixer.master.effects,
    },
    channels: project.audioMixer.channels.map((channel) => ({
      id: channel.id,
      sourceIds: [...channel.sourceIds],
      trimDb: channel.trimDb,
      faderDb: channel.faderDb,
      pan: channel.pan,
      muted: channel.muted,
      solo: channel.solo,
      monitoring: channel.monitoring,
      enabledInScene: channelAudibleInScene(channel, enabled),
      effects: channel.effects,
    })),
    overlay: {
      faderDb: project.audioMixer.overlay.faderDb,
      muted: project.audioMixer.overlay.muted,
      solo: project.audioMixer.overlay.solo,
      monitoring: project.audioMixer.overlay.monitoring,
      effects: project.audioMixer.overlay.effects,
    },
  };
};

export function provideStudioAudioEngine(): StudioAudioEngineHandle {
  const store = useStudioSessionStore();
  const levels = reactive<AudioLevels>(emptyAudioLevels());
  const armedIds = new Set<string>();
  let engine: AudioEngine | null = null;
  let stopWatch: (() => void) | null = null;
  let endedListener: ((instanceId: string) => void) | null = null;

  const handle: StudioAudioEngineHandle = {
    levels,
    armStream: (sourceId, stream, release) => {
      engine?.armStream(sourceId, stream, release);
      armedIds.add(sourceId);
    },
    armFile: async (sourceId, url) => {
      if (!engine) {
        return;
      }
      await engine.armFile(sourceId, url);
      armedIds.add(sourceId);
    },
    hasArmed: (sourceId) => engine?.hasArmed(sourceId) ?? false,
    getProgramStream: () => engine?.getProgramStream() ?? null,
    readProgramFrequency: (bins) => engine?.readProgramFrequency(bins) ?? false,
    readCurve: (effect) => engine?.readCurve(effect) ?? null,
    setMonitorSink: async (sinkId) => engine?.setMonitorSink(sinkId) ?? { ok: false, reason: 'unsupported' },
    loadOverlayBuffer: async (cacheKey, url) => {
      if (!engine) {
        throw new Error('Audio engine is not running');
      }
      return engine.loadOverlayBuffer(cacheKey, url);
    },
    retainOverlayBuffers: (keep) => engine?.retainOverlayBuffers(keep),
    startOverlayInstance: (request) => engine?.startOverlayInstance(request),
    stopOverlayInstance: (instanceId) => engine?.stopOverlayInstance(instanceId),
    setOverlayInstanceGain: (instanceId, volumeDb, muted) =>
      engine?.setOverlayInstanceGain(instanceId, volumeDb, muted),
    setOverlayEndedListener: (listener) => {
      endedListener = listener;
      engine?.setOverlayEndedListener(listener);
    },
  };

  onMounted(() => {
    const next = new AudioEngine();
    engine = next;
    next.setOverlayEndedListener(endedListener);
    next.setLevelListener((reading) => {
      levels.master = reading.master;
      levels.overlay = reading.overlay;
      levels.reductions = reading.reductions;
      levels.chainError = reading.chainError;
      const nextChannels: AudioLevels['channels'] = {};
      for (const [key, value] of Object.entries(reading.channels)) {
        nextChannels[key] = value;
      }
      levels.channels = nextChannels;
    });

    stopWatch = watch(
      () => {
        const project = store.project;
        if (!project) {
          return null;
        }
        return {
          snapshot: snapshotFromStore(project, store.activeSceneId),
          sourceIds: project.sources.filter((source) => source.type === 'audio').map((source) => source.id),
        };
      },
      (current) => {
        if (!engine) {
          return;
        }
        if (!current) {
          const idle = createDefaultOverlayBus();
          engine.sync({
            master: { volume: 1, muted: true, effects: [] },
            channels: [],
            overlay: {
              faderDb: idle.faderDb,
              muted: true,
              solo: idle.solo,
              monitoring: idle.monitoring,
              effects: [],
            },
          });
          return;
        }
        engine.sync(current.snapshot);
        const keep = new Set(current.sourceIds);
        for (const sourceId of [...armedIds]) {
          if (!keep.has(sourceId)) {
            engine.releaseSource(sourceId);
            armedIds.delete(sourceId);
          }
        }
      },
      { deep: true, immediate: true },
    );
  });

  onScopeDispose(() => {
    stopWatch?.();
    engine?.dispose();
    engine = null;
    armedIds.clear();
  });

  provide(StudioAudioEngineKey, handle);
  return handle;
}

export function useStudioAudioEngine(): StudioAudioEngineHandle {
  return (
    inject(StudioAudioEngineKey, null) ?? {
      levels: reactive(emptyAudioLevels()),
      armStream: () => undefined,
      armFile: async () => undefined,
      hasArmed: () => false,
      getProgramStream: () => null,
      readProgramFrequency: () => false,
      readCurve: () => null,
      setMonitorSink: async () => ({ ok: false, reason: 'unsupported' }),
      loadOverlayBuffer: async () => {
        throw new Error('Audio engine is not running');
      },
      retainOverlayBuffers: () => undefined,
      startOverlayInstance: () => undefined,
      stopOverlayInstance: () => undefined,
      setOverlayInstanceGain: () => undefined,
      setOverlayEndedListener: () => undefined,
    }
  );
}
