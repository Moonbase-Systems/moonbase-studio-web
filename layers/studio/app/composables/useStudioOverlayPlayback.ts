import type { InjectionKey, Ref } from 'vue';
import { inject, onMounted, onScopeDispose, provide, ref, watch } from 'vue';

import { playCueOnBus, publishOverlayCueTrace, publishOverlayPlaybackNotice } from '../application/overlay-cue-trace';
import { subscribeOverlayCues } from '../application/overlay-cues';
import type { OverlayRuntimeInstance } from '../application/overlay-playback';
import { OverlayPlaybackController, type OverlayPlaybackError } from '../application/overlay-playback-session';
import { peekOverlayAssetUrl } from '../infrastructure/audio/overlay-asset-url';
import type { Project } from '../models/project.domain';
import { useStudioSessionStore } from '../store/studio-session.store';
import type { StudioAudioEngineHandle } from './useStudioAudioEngine';

export type StudioOverlayPlayback = {
  instances: Ref<readonly OverlayRuntimeInstance[]>;
  queuedCount: Ref<number>;
  error: Ref<OverlayPlaybackError | null>;
  play: (soundId: string) => Promise<void>;
  /** Plays one https file from an alert on the overlay bus. A blank or unsafe URL does not start a voice. */
  playUrl: (url: string, volumeDb: number, sceneId: string | null) => Promise<void>;
  stop: (instanceId: string) => Promise<void>;
  stopAll: () => Promise<void>;
};

const StudioOverlayPlaybackKey: InjectionKey<StudioOverlayPlayback> = Symbol('studio-overlay-playback');

const resolveAsset = (project: Project | null, assetId: string) => {
  const asset = project?.assets.find((item) => item.id === assetId);
  if (!asset || asset.type !== 'audio') {
    return null;
  }
  if (asset.location.kind === 'remoteUrl') {
    return { cacheKey: `${asset.id}:${asset.location.url}`, url: asset.location.url };
  }
  const url = peekOverlayAssetUrl(asset.id);
  if (!url) {
    return null;
  }
  return { cacheKey: `${asset.id}:${asset.location.key}`, url };
};

export function provideStudioOverlayPlayback(engine: StudioAudioEngineHandle): StudioOverlayPlayback {
  const store = useStudioSessionStore();
  const instances = ref<readonly OverlayRuntimeInstance[]>([]);
  const queuedCount = ref(0);
  const error = ref<OverlayPlaybackError | null>(null);
  let voiceId = 0;

  const controller = new OverlayPlaybackController({
    port: {
      loadBuffer: (cacheKey, url) => engine.loadOverlayBuffer(cacheKey, url),
      start: (request) => {
        engine.startOverlayInstance({
          ...request,
          buffer: request.buffer as AudioBuffer,
        });
      },
      stop: (instanceId) => engine.stopOverlayInstance(instanceId),
      setGain: (instanceId, volumeDb, muted) => engine.setOverlayInstanceGain(instanceId, volumeDb, muted),
      retain: (keys) => engine.retainOverlayBuffers(keys),
    },
    now: () => performance.now(),
    createId: () => `overlay-voice-${++voiceId}`,
    resolve: (assetId) => resolveAsset(store.project, assetId),
    onChange: () => {
      instances.value = [...controller.instances];
      queuedCount.value = controller.queuedCount;
    },
    onError: (code) => {
      error.value = code;
    },
  });

  engine.setOverlayEndedListener((instanceId) => {
    const overlay = store.project?.audioMixer.overlay;
    if (!overlay) {
      return;
    }
    const instance = controller.instances.find((item) => item.id === instanceId);
    const sound = overlay.sounds.find((item) => item.id === instance?.soundId);
    void controller.onEnded(instanceId, overlay.sounds, overlay.maxInstances).then(() => {
      if (sound) {
        publishOverlayPlaybackNotice({ at: Date.now(), soundId: sound.id, soundName: sound.name });
      }
    });
  });

  const playback: StudioOverlayPlayback = {
    instances,
    queuedCount,
    error,
    play: async (soundId) => {
      const overlay = store.project?.audioMixer.overlay;
      const sound = overlay?.sounds.find((item) => item.id === soundId);
      if (!overlay || !sound) {
        return;
      }
      const outcome = await controller.play(sound, null, overlay.maxInstances);
      error.value = outcome === 'missing-bytes' || outcome === 'decode-failed' ? outcome : null;
    },
    playUrl: async (url, volumeDb, sceneId) => {
      const maxInstances = store.project?.audioMixer.overlay.maxInstances ?? 16;
      const outcome = await controller.playUrl(url, volumeDb, sceneId, maxInstances);
      error.value = outcome === 'missing-bytes' || outcome === 'decode-failed' ? outcome : null;
    },
    stop: (instanceId) => {
      const overlay = store.project?.audioMixer.overlay;
      return controller.stop(instanceId, overlay?.sounds ?? [], overlay?.maxInstances ?? 16);
    },
    stopAll: () => controller.stopAll(),
  };

  let unsubscribe = () => {};
  onMounted(() => {
    unsubscribe = subscribeOverlayCues((cue) => {
      const overlay = store.project?.audioMixer.overlay;
      if (!overlay) {
        return;
      }
      void playCueOnBus(overlay, cue, (sound) =>
        controller.play(sound, cue.sceneId ?? null, overlay.maxInstances),
      ).then((trace) => {
        publishOverlayCueTrace(trace);
      });
    });
  });

  watch(
    () => store.activeSceneId,
    (next, previous) => {
      if (!previous || previous === next) {
        return;
      }
      const policy = store.project?.audioMixer.overlay.sceneChangePolicy ?? 'continue';
      void controller.applySceneChange(policy, previous);
    },
  );

  watch(
    () => store.project?.audioMixer.overlay.sounds,
    (sounds) => {
      if (sounds) {
        void controller.syncSounds(sounds);
      }
    },
    { deep: true },
  );

  onScopeDispose(() => {
    unsubscribe();
    engine.setOverlayEndedListener(null);
    void controller.stopAll();
  });

  provide(StudioOverlayPlaybackKey, playback);
  return playback;
}

export function useStudioOverlayPlayback(): StudioOverlayPlayback {
  return (
    inject(StudioOverlayPlaybackKey, null) ?? {
      instances: ref([]),
      queuedCount: ref(0),
      error: ref(null),
      play: async () => undefined,
      playUrl: async () => undefined,
      stop: async () => undefined,
      stopAll: async () => undefined,
    }
  );
}
