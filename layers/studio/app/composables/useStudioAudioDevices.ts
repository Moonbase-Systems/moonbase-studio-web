import type { InjectionKey } from 'vue';
import { inject, onMounted, onScopeDispose, provide, reactive, ref, watch } from 'vue';

import {
  type AudioDevicePort,
  AudioDeviceSession,
  type AudioDeviceSnapshot,
} from '../infrastructure/audio/audio-devices';
import { disarmBrowserProcessing, rawTabAudioConstraints } from '../infrastructure/audio/raw-capture';
import { microphoneSourcesToResume } from '../playback/microphone-resume';
import { useStudioSessionStore } from '../store/studio-session.store';
import type { StudioAudioEngineHandle } from './useStudioAudioEngine';

export type StudioAudioDeviceHandle = {
  snapshot: AudioDeviceSnapshot;
  systemEnded: boolean;
  systemLive: boolean;
  browserTabLive: boolean;
  revealLabels: () => Promise<void>;
  startMicrophone: (sourceId: string, deviceId: string) => Promise<void>;
  armSystemStream: (sourceId: string, stream: MediaStream) => void;
  captureBrowserTab: () => Promise<MediaStream | null>;
  attachBrowserTab: (sourceId: string, stream: MediaStream) => void;
};

const StudioAudioDevicesKey: InjectionKey<StudioAudioDeviceHandle> = Symbol('studio-audio-devices');

const emptySnapshot = (): AudioDeviceSnapshot => ({
  permission: 'unknown',
  labelsHidden: false,
  inputs: [],
  outputs: [],
});

const browserPort = (): AudioDevicePort => ({
  enumerateDevices: async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    const listed = await navigator.mediaDevices.enumerateDevices();
    return listed.map((device) => ({
      deviceId: device.deviceId,
      kind: device.kind,
      label: device.label,
      groupId: device.groupId,
    }));
  },
  getUserMedia: async (constraints) => {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    await disarmBrowserProcessing(stream.getAudioTracks());
    return stream;
  },
  addDeviceChangeListener: (listener) => {
    navigator.mediaDevices?.addEventListener('devicechange', listener);
  },
  removeDeviceChangeListener: (listener) => {
    navigator.mediaDevices?.removeEventListener('devicechange', listener);
  },
});

export function provideStudioAudioDevices(engine: StudioAudioEngineHandle): StudioAudioDeviceHandle {
  const snapshot = reactive<AudioDeviceSnapshot>(emptySnapshot());
  const systemEnded = ref(false);
  const systemLive = ref(false);
  const browserTabLive = ref(false);
  let session: AudioDeviceSession | null = null;
  let systemStream: MediaStream | null = null;
  let resumeGeneration = 0;
  const store = useStudioSessionStore();

  const captureBrowserTab = async (): Promise<MediaStream | null> => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      return null;
    }
    const focus = globalThis as { CaptureController?: new () => { setFocusBehavior: (behavior: string) => void } };
    const controller = focus.CaptureController ? new focus.CaptureController() : undefined;
    try {
      controller?.setFocusBehavior('no-focus-change');
    } catch {
      // The focus hint is optional. Capture still starts from this click.
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: rawTabAudioConstraints(),
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        ...(controller ? { controller } : {}),
      } as DisplayMediaStreamOptions);
    } catch {
      return null;
    }
    for (const track of stream.getVideoTracks()) {
      track.stop();
    }
    const audible = stream.getAudioTracks().filter((track) => track.readyState === 'live');
    if (audible.length === 0) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      return null;
    }
    await disarmBrowserProcessing(audible);
    return stream;
  };

  const apply = (next: AudioDeviceSnapshot) => {
    snapshot.permission = next.permission;
    snapshot.labelsHidden = next.labelsHidden;
    snapshot.inputs = next.inputs;
    snapshot.outputs = next.outputs;
  };

  onMounted(() => {
    const next = new AudioDeviceSession(browserPort());
    session = next;
    const stop = next.start();
    const unsubscribe = next.subscribe(apply);
    const resumeMicrophones = async () => {
      const token = ++resumeGeneration;
      const project = store.project;
      const projectId = project?.id;
      if (!project || !projectId) {
        return;
      }
      for (const item of microphoneSourcesToResume(project)) {
        if (token !== resumeGeneration || store.project?.id !== projectId) {
          return;
        }
        try {
          await handle.startMicrophone(item.sourceId, item.deviceId);
        } catch {
          // A missing device or a denied permission leaves the source in the document.
        }
      }
    };
    const stopResume = watch(
      () => store.project?.id,
      () => {
        void resumeMicrophones();
      },
      { immediate: true },
    );
    onScopeDispose(() => {
      stop();
      unsubscribe();
      stopResume();
      session = null;
    });
  });

  const handle: StudioAudioDeviceHandle = reactive({
    snapshot,
    get systemEnded() {
      return systemEnded.value;
    },
    get systemLive() {
      return systemLive.value;
    },
    get browserTabLive() {
      return browserTabLive.value;
    },
    revealLabels: async () => {
      await session?.revealLabels();
    },
    startMicrophone: async (sourceId, deviceId) => {
      if (!session) {
        return;
      }
      const stream = await session.startMicrophone(sourceId, deviceId);
      const tracks = stream.getAudioTracks();
      engine.armStream(sourceId, stream as MediaStream, () => {
        session?.releaseTracks(sourceId, tracks);
      });
    },
    armSystemStream: (sourceId, stream) => {
      systemStream = stream;
      systemEnded.value = false;
      systemLive.value = true;
      for (const track of stream.getAudioTracks()) {
        track.addEventListener('ended', () => {
          if (systemStream !== stream) {
            return;
          }
          systemLive.value = false;
          systemEnded.value = true;
        });
      }
      engine.armStream(sourceId, stream);
    },
    captureBrowserTab,
    attachBrowserTab: (sourceId, stream) => {
      let active = true;
      for (const track of stream.getAudioTracks()) {
        track.addEventListener('ended', () => {
          if (active) {
            browserTabLive.value = false;
          }
        });
      }
      engine.armStream(sourceId, stream, () => {
        active = false;
        browserTabLive.value = false;
        for (const track of stream.getTracks()) {
          track.stop();
        }
      });
      browserTabLive.value = true;
    },
  });

  provide(StudioAudioDevicesKey, handle);
  return handle;
}

export function useStudioAudioDevices(): StudioAudioDeviceHandle {
  return (
    inject(StudioAudioDevicesKey, null) ?? {
      snapshot: reactive(emptySnapshot()),
      systemEnded: false,
      systemLive: false,
      browserTabLive: false,
      revealLabels: async () => undefined,
      startMicrophone: async () => undefined,
      armSystemStream: () => undefined,
      captureBrowserTab: async () => null,
      attachBrowserTab: () => undefined,
    }
  );
}
