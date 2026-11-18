import type { InjectionKey, Ref } from 'vue';
import { inject, onScopeDispose, provide, ref, watch } from 'vue';

import { deliveredFramesPerSecond } from '../infrastructure/output/frame-delivery';
import { createOutputCapture, type OutputCapture } from '../infrastructure/output/output-capture';
import {
  AUDIO_BITRATE,
  videoBitrateForFrame,
  type VideoBitratePreset,
} from '../infrastructure/recording/recording-bitrate';
import { formatRecordingClock } from '../infrastructure/recording/recording-clock';
import {
  createRecordingEngine,
  type RecorderLike,
  type RecordingEngine,
  type RecordingState,
} from '../infrastructure/recording/recording-engine';
import { recordingFileName } from '../infrastructure/recording/recording-filename';
import { createRecordingLibrary } from '../infrastructure/recording/recording-library';
import { chooseRecordingMime } from '../infrastructure/recording/recording-mime';
import { createRecordingRecord, type RecordingRecord } from '../infrastructure/recording/recording-record';
import { beginRecordingFile, type RecordingWriterSession } from '../infrastructure/recording/recording-writer';
import { outputFrame } from '../models/output-profile.domain';
import { useStudioSessionStore } from '../store/studio-session.store';
import { STUDIO_RECORDING_GUARD } from './recording-guard';
import type { CompositionEngineHandle } from './useCompositionEngine';
import type { StudioAudioEngineHandle } from './useStudioAudioEngine';

export type StudioRecordingHandle = {
  state: Ref<RecordingState>;
  elapsedLabel: Ref<string>;
  error: Ref<string | null>;
  mimeType: Ref<string>;
  videoBitrate: Ref<VideoBitratePreset>;
  audioBitrate: number;
  requestedFrameRate: Ref<number>;
  measuredFrameRate: Ref<number | null>;
  frameLabel: Ref<string>;
  recordings: Ref<RecordingRecord[]>;
  canOpen: (record: RecordingRecord) => boolean;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<void>;
  openRecording: (record: RecordingRecord) => Promise<void>;
  allowActiveSceneChange: () => Promise<boolean>;
};

const STUDIO_RECORDING: InjectionKey<StudioRecordingHandle> = Symbol('studio-recording');

type CapturableCanvas = HTMLCanvasElement & {
  captureStream: (frameRate: number) => MediaStream;
};

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
};

const adaptRecorder = (recorder: MediaRecorder): RecorderLike => {
  const wrapped: RecorderLike = {
    mimeType: recorder.mimeType,
    get state() {
      return recorder.state;
    },
    start: (timesliceMs) => recorder.start(timesliceMs),
    stop: () => recorder.stop(),
    pause: () => recorder.pause(),
    resume: () => recorder.resume(),
    ondataavailable: null,
    onstop: null,
    onerror: null,
  };
  recorder.addEventListener('dataavailable', (event) => {
    wrapped.ondataavailable?.(event.data);
  });
  recorder.addEventListener('stop', () => {
    wrapped.onstop?.();
  });
  recorder.addEventListener('error', () => {
    wrapped.onerror?.();
  });
  return wrapped;
};

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const canOpenHandle = (handle: unknown): handle is FileSystemFileHandle =>
  typeof FileSystemFileHandle !== 'undefined' && handle instanceof FileSystemFileHandle;

export function provideStudioRecording(
  composition: CompositionEngineHandle,
  audio: StudioAudioEngineHandle,
): StudioRecordingHandle {
  const store = useStudioSessionStore();
  const { t } = useI18n();
  const library = createRecordingLibrary();
  const state = ref<RecordingState>('idle');
  const elapsedLabel = ref(formatRecordingClock(0));
  const error = ref<string | null>(null);
  const mimeType = ref('');
  const videoBitrate = ref<VideoBitratePreset>('standard');
  const requestedFrameRate = ref(0);
  const measuredFrameRate = ref<number | null>(null);
  const frameLabel = ref('');
  const recordings = ref<RecordingRecord[]>([]);

  let capture: OutputCapture | null = null;
  let engine: RecordingEngine | null = null;
  let fileSession: RecordingWriterSession | null = null;
  let activeFileName = '';
  let writes = Promise.resolve();
  let timer = 0;

  const refreshDelivery = (): void => {
    const profile = outputFrame(store.project);
    requestedFrameRate.value = profile.frameRate;
    frameLabel.value = `${profile.width}×${profile.height}`;
    measuredFrameRate.value = deliveredFramesPerSecond(composition.readFrameDelivery());
    elapsedLabel.value = formatRecordingClock(engine?.elapsedMs() ?? 0);
  };

  const armTimer = (): void => {
    window.clearInterval(timer);
    timer = window.setInterval(refreshDelivery, 200);
  };

  const loadLibrary = async (): Promise<void> => {
    const projectId = store.project?.id;
    if (!projectId) {
      recordings.value = [];
      return;
    }
    try {
      recordings.value = await library.listByProject(projectId);
    } catch (cause) {
      console.warn('[studio] Recording library failed:', cause);
    }
  };

  const makeCapture = (): OutputCapture =>
    createOutputCapture({
      getCanvas: () => {
        const canvas = composition.getOutputCanvas();
        if (!canvas || typeof (canvas as CapturableCanvas).captureStream !== 'function') {
          return null;
        }
        return {
          captureStream: (frameRate) => (canvas as CapturableCanvas).captureStream(frameRate),
        };
      },
      getFrameRate: () => outputFrame(store.project).frameRate,
      getProgramStream: () => audio.getProgramStream(),
    });

  async function stop(): Promise<void> {
    if (!engine || (engine.state !== 'recording' && engine.state !== 'paused')) {
      return;
    }
    state.value = 'finalizing';
    const result = await engine.stop();
    await writes;
    let closed: { sizeBytes: number } | undefined;
    try {
      closed = await fileSession?.close();
    } finally {
      capture?.stop();
      composition.setOutputCaptureActive(false);
      window.clearInterval(timer);
    }
    try {
      if (result.ok && closed && store.project) {
        const profile = outputFrame(store.project);
        await library.add(
          createRecordingRecord({
            id: crypto.randomUUID(),
            projectId: store.project.id,
            fileName: activeFileName,
            mimeType: engine.mime?.mimeType ?? mimeType.value,
            sizeBytes: closed.sizeBytes,
            durationMs: result.elapsedMs,
            width: profile.width,
            height: profile.height,
            frameRate: profile.frameRate,
            createdAt: new Date().toISOString(),
            fileHandle: fileSession?.handle ?? undefined,
          }),
        );
      }
    } finally {
      state.value = engine.state;
      fileSession = null;
      refreshDelivery();
    }
    await loadLibrary();
  }

  const handle: StudioRecordingHandle = {
    state,
    elapsedLabel,
    error,
    mimeType,
    videoBitrate,
    audioBitrate: AUDIO_BITRATE,
    requestedFrameRate,
    measuredFrameRate,
    frameLabel,
    recordings,
    canOpen: (record) => canOpenHandle(record.fileHandle),
    async start() {
      if (!store.project || (engine && ['preparing', 'recording', 'paused', 'finalizing'].includes(engine.state))) {
        return;
      }
      error.value = null;
      capture?.dispose();
      capture = makeCapture();
      composition.setOutputCaptureActive(true);
      const opened = capture.open();
      if (!opened.ok || !capture.stream) {
        composition.setOutputCaptureActive(false);
        error.value = opened.ok ? 'video' : opened.reason;
        state.value = 'error';
        return;
      }
      const supported = (type: string) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type);
      const chosen = chooseRecordingMime(supported);
      if (!chosen) {
        capture.stop();
        composition.setOutputCaptureActive(false);
        error.value = 'mime';
        state.value = 'error';
        return;
      }
      const profile = outputFrame(store.project);
      const fileName = recordingFileName(store.project.name, new Date(), chosen.extension);
      const picker = (window as SavePickerWindow).showSaveFilePicker?.bind(window);
      try {
        fileSession = await beginRecordingFile(
          {
            pick: picker,
            download: downloadBlob,
          },
          { fileName, mimeType: chosen.mimeType },
        );
      } catch (cause) {
        capture.stop();
        composition.setOutputCaptureActive(false);
        error.value = cause instanceof Error ? cause.message : 'save';
        state.value = 'error';
        return;
      }
      if (fileSession.cancelled) {
        capture.stop();
        composition.setOutputCaptureActive(false);
        state.value = 'idle';
        return;
      }
      const session = fileSession;
      activeFileName = fileName;
      writes = Promise.resolve();
      engine = createRecordingEngine({
        isTypeSupported: supported,
        onChunk: (chunk) => {
          writes = writes.then(() => session.write(chunk));
        },
        createRecorder: (stream, mime, videoBits, audioBits) =>
          adaptRecorder(
            new MediaRecorder(stream as MediaStream, {
              mimeType: mime,
              videoBitsPerSecond: videoBits,
              audioBitsPerSecond: audioBits,
            }),
          ),
      });
      const started = engine.start(capture.stream, {
        videoBitsPerSecond: videoBitrateForFrame(videoBitrate.value, profile.width, profile.height),
        audioBitsPerSecond: AUDIO_BITRATE,
      });
      if (!started.ok) {
        await session.abort();
        capture.stop();
        composition.setOutputCaptureActive(false);
        error.value = started.reason;
        state.value = 'error';
        return;
      }
      capture.markCapturing();
      mimeType.value = started.mime.mimeType;
      state.value = 'recording';
      armTimer();
      refreshDelivery();
    },
    pause() {
      engine?.pause();
      if (engine) {
        state.value = engine.state;
      }
    },
    resume() {
      engine?.resume();
      if (engine) {
        state.value = engine.state;
      }
    },
    stop,
    async openRecording(record) {
      if (!canOpenHandle(record.fileHandle)) {
        return;
      }
      const file = await record.fileHandle.getFile();
      const url = URL.createObjectURL(file);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    async allowActiveSceneChange() {
      if (state.value !== 'recording' && state.value !== 'paused') {
        return true;
      }
      if (!window.confirm(t('studio.recording.interrupt'))) {
        return false;
      }
      await stop();
      return true;
    },
  };

  watch(
    () => store.project?.id ?? null,
    async (projectId, previous) => {
      refreshDelivery();
      if (previous && projectId !== previous) {
        if (state.value === 'recording' || state.value === 'paused') {
          await stop();
        }
        capture?.dispose();
        capture = null;
      }
      await loadLibrary();
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    window.clearInterval(timer);
    capture?.dispose();
    composition.setOutputCaptureActive(false);
  });

  provide(STUDIO_RECORDING, handle);
  provide(STUDIO_RECORDING_GUARD, { allowActiveSceneChange: handle.allowActiveSceneChange });
  return handle;
}

export function useStudioRecording(): StudioRecordingHandle {
  const handle = inject(STUDIO_RECORDING, null);
  if (!handle) {
    throw new Error('useStudioRecording() needs provideStudioRecording() in StudioWorkspace');
  }
  return handle;
}
