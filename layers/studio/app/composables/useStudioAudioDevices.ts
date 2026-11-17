import type { InjectionKey } from 'vue';
import { inject, onMounted, onScopeDispose, provide, reactive, ref } from 'vue';

import {
  type AudioDevicePort,
  AudioDeviceSession,
  type AudioDeviceSnapshot,
} from '../infrastructure/audio/audio-devices';
import type { StudioAudioEngineHandle } from './useStudioAudioEngine';

export type StudioAudioDeviceHandle = {
  snapshot: AudioDeviceSnapshot;
  systemEnded: boolean;
  revealLabels: () => Promise<void>;
  startMicrophone: (sourceId: string, deviceId: string) => Promise<void>;
  armSystemStream: (sourceId: string, stream: MediaStream) => void;
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
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
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
  let session: AudioDeviceSession | null = null;

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
    onScopeDispose(() => {
      stop();
      unsubscribe();
      session = null;
    });
  });

  const handle: StudioAudioDeviceHandle = reactive({
    snapshot,
    get systemEnded() {
      return systemEnded.value;
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
      systemEnded.value = false;
      for (const track of stream.getAudioTracks()) {
        track.addEventListener('ended', () => {
          systemEnded.value = true;
        });
      }
      engine.armStream(sourceId, stream);
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
      revealLabels: async () => undefined,
      startMicrophone: async () => undefined,
      armSystemStream: () => undefined,
    }
  );
}
