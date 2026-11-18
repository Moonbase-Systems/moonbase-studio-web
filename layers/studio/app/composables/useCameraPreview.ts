import { onScopeDispose, watch } from 'vue';

import {
  cameraPreviewDeviceId,
  holdCameraPreviewStream,
  peekCameraPreviewStream,
  releaseCameraPreviewStreams,
} from '../components/properties-inspector/camera-preview-stream';
import type { CameraSource } from '../models/source.domain';
import { useStudioSessionStore } from '../store/studio-session.store';

/** Opens each camera on the active scene once. Recording reuses the same stream. */
export function useCameraPreview(onChange: () => void): void {
  const store = useStudioSessionStore();
  let generation = 0;

  const camerasOnActiveScene = (): CameraSource[] => {
    const scene = store.activeScene;
    const sources = store.project?.sources ?? [];
    if (!scene) {
      return [];
    }
    const ids = new Set(scene.elements.flatMap((element) => (element.type === 'camera' ? [element.sourceId] : [])));
    return sources.filter((source): source is CameraSource => source.type === 'camera' && ids.has(source.id));
  };

  watch(
    () =>
      camerasOnActiveScene()
        .map((source) => `${source.id}:${source.deviceId ?? ''}`)
        .join('|'),
    async () => {
      const token = ++generation;
      for (const source of camerasOnActiveScene()) {
        const deviceId = source.deviceId ?? '';
        const existing = peekCameraPreviewStream(source.id);
        const live = existing?.getVideoTracks().some((track) => track.readyState === 'live') ?? false;
        if (live && cameraPreviewDeviceId(source.id) === deviceId) {
          continue;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: deviceId ? { deviceId: { exact: deviceId } } : true,
          });
          if (token !== generation) {
            for (const track of stream.getTracks()) {
              track.stop();
            }
            return;
          }
          holdCameraPreviewStream(source.id, deviceId, stream);
          onChange();
        } catch (error) {
          console.warn('[studio] Camera preview failed:', error);
        }
      }
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    generation += 1;
    releaseCameraPreviewStreams();
  });
}
