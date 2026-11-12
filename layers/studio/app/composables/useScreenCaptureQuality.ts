import type { Ref } from 'vue';

import { applyScreenCaptureConstraints } from '../components/properties-inspector/screen-preview-stream';
import type { ProjectVideoSettings } from '../models/project.domain';
import {
  BACKGROUND_PREVIEW_FRAME_RATE,
  captureConstraints,
  projectCaptureFrame,
} from '../playback/screen-capture-constraints';
import { useStudioSessionStore } from '../store/studio-session.store';

const FALLBACK_VIDEO: ProjectVideoSettings = { width: 1920, height: 1080, frameRate: 30 };

const live = ref(false);
let projectConstraints = captureConstraints(projectCaptureFrame(FALLBACK_VIDEO));

/**
 * Recording and streaming call this before they start: captures go back to the project size
 * and stay there while the studio window is in the background.
 */
export async function setScreenCaptureLive(value: boolean): Promise<void> {
  live.value = value;
  if (value) {
    await applyScreenCaptureConstraints(projectConstraints);
  }
}

export type ScreenCaptureQuality = {
  /** Frames per second the scene preview may draw a capture at; null means every new frame. */
  previewFrameRateCap: Readonly<Ref<number | null>>;
};

/**
 * Keeps screen-capture ceilings at the project size.
 *
 * Do not call `applyConstraints` when the studio window blurs: Chromium's window-capture path
 * (Windows Graphics Capture) can permanently freeze or go black if the track is renegotiated while
 * the shared window is minimised or mid-restore. Preview cost while unfocused is handled only by
 * capping how often Pixi uploads frames (`previewFrameRateCap`).
 */
export function useScreenCaptureQuality(): ScreenCaptureQuality {
  const store = useStudioSessionStore();
  const foreground = ref(true);

  const refreshForeground = (): void => {
    foreground.value = document.visibilityState === 'visible' && document.hasFocus();
  };

  const video = computed(() => store.project?.settings.video ?? FALLBACK_VIDEO);
  // Project edits replace the settings object; compare by value so captures are only re-negotiated
  // when the ceiling itself changes.
  const target = computed(() => {
    const { width, height, frameRate } = video.value;
    return JSON.stringify([width, height, frameRate]);
  });

  watch(
    target,
    () => {
      const settings = video.value;
      projectConstraints = captureConstraints(projectCaptureFrame(settings));
      if (!import.meta.client) {
        return;
      }
      void applyScreenCaptureConstraints(projectConstraints);
    },
    { immediate: true },
  );

  onMounted(() => {
    refreshForeground();
    window.addEventListener('focus', refreshForeground);
    window.addEventListener('blur', refreshForeground);
    document.addEventListener('visibilitychange', refreshForeground);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('focus', refreshForeground);
    window.removeEventListener('blur', refreshForeground);
    document.removeEventListener('visibilitychange', refreshForeground);
  });

  return {
    previewFrameRateCap: computed(() => (live.value && !foreground.value ? BACKGROUND_PREVIEW_FRAME_RATE : null)),
  };
}
