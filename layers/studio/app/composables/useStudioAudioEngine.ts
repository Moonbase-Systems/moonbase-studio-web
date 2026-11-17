import type { InjectionKey } from 'vue';
import { inject, onMounted, onScopeDispose, provide, reactive, watch } from 'vue';

import {
  AudioEngine,
  type AudioGraphSnapshot,
  type AudioLevels,
  emptyAudioLevels,
  type MonitorSinkResult,
} from '../infrastructure/audio/audio-engine';
import type { AudioEffect } from '../models/audio.domain';
import { useStudioSessionStore } from '../store/studio-session.store';

export type StudioAudioEngineHandle = {
  levels: AudioLevels;
  armStream: (sourceId: string, stream: MediaStream, release?: () => void) => void;
  armFile: (sourceId: string, url: string) => Promise<void>;
  hasArmed: (sourceId: string) => boolean;
  getProgramStream: () => MediaStream | null;
  readCurve: (effect: AudioEffect) => { frequencies: number[]; magnitudeDb: number[] } | null;
  setMonitorSink: (sinkId: string) => Promise<MonitorSinkResult>;
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
      enabledInScene: enabled.has(channel.id),
      effects: channel.effects,
    })),
  };
};

export function provideStudioAudioEngine(): StudioAudioEngineHandle {
  const store = useStudioSessionStore();
  const levels = reactive<AudioLevels>(emptyAudioLevels());
  const armedIds = new Set<string>();
  let engine: AudioEngine | null = null;
  let stopWatch: (() => void) | null = null;

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
    readCurve: (effect) => engine?.readCurve(effect) ?? null,
    setMonitorSink: async (sinkId) => engine?.setMonitorSink(sinkId) ?? { ok: false, reason: 'unsupported' },
  };

  onMounted(() => {
    const next = new AudioEngine();
    engine = next;
    next.setLevelListener((reading) => {
      levels.master = reading.master;
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
          engine.sync({ master: { volume: 1, muted: true, effects: [] }, channels: [] });
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
      readCurve: () => null,
      setMonitorSink: async () => ({ ok: false, reason: 'unsupported' }),
    }
  );
}
