import { createElapsedClock } from './recording-clock';
import { chooseRecordingMime, type RecordingMime } from './recording-mime';

export type RecordingState = 'idle' | 'preparing' | 'recording' | 'paused' | 'finalizing' | 'completed' | 'error';

export type RecorderLike = {
  mimeType: string;
  state: string;
  start: (timesliceMs?: number) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  ondataavailable: ((chunk: Blob) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
};

export type RecordingStart =
  | {
      ok: true;
      mime: RecordingMime;
    }
  | {
      ok: false;
      reason: 'busy' | 'mime' | 'error';
    };

export type RecordingEngineOptions = {
  now?: () => number;
  isTypeSupported: (mimeType: string) => boolean;
  createRecorder: (
    stream: unknown,
    mimeType: string,
    videoBitsPerSecond: number,
    audioBitsPerSecond: number,
  ) => RecorderLike;
  onChunk: (chunk: Blob) => void;
};

export type RecordingEngine = {
  readonly state: RecordingState;
  readonly mime: RecordingMime | null;
  elapsedMs: () => number;
  start: (stream: unknown, bits: { videoBitsPerSecond: number; audioBitsPerSecond: number }) => RecordingStart;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<{ ok: true; elapsedMs: number } | { ok: false; reason: 'idle' }>;
};

const BUSY: readonly RecordingState[] = ['preparing', 'recording', 'paused', 'finalizing'];

/** MediaRecorder wrapper. A second start while busy is rejected. Stop waits for the last chunk. */
export const createRecordingEngine = (options: RecordingEngineOptions): RecordingEngine => {
  const now = options.now ?? (() => performance.now());
  const clock = createElapsedClock(now);
  let state: RecordingState = 'idle';
  let failed = false;
  let mime: RecordingMime | null = null;
  let recorder: RecorderLike | null = null;
  let stopWait: (() => void) | null = null;

  const setState = (next: RecordingState): void => {
    state = next;
  };

  return {
    get state() {
      return state;
    },
    get mime() {
      return mime;
    },
    elapsedMs: () => clock.elapsed(),
    start(stream, bits) {
      if (BUSY.includes(state)) {
        return { ok: false, reason: 'busy' };
      }
      const chosen = chooseRecordingMime(options.isTypeSupported);
      if (!chosen) {
        setState('error');
        return { ok: false, reason: 'mime' };
      }
      failed = false;
      setState('preparing');
      try {
        recorder = options.createRecorder(stream, chosen.mimeType, bits.videoBitsPerSecond, bits.audioBitsPerSecond);
      } catch {
        setState('error');
        return { ok: false, reason: 'error' };
      }
      mime = chosen;
      recorder.ondataavailable = (chunk) => {
        if (chunk.size > 0) {
          options.onChunk(chunk);
        }
      };
      recorder.onerror = () => {
        failed = true;
        setState('error');
      };
      recorder.onstop = () => {
        stopWait?.();
        stopWait = null;
      };
      recorder.start(1000);
      clock.start();
      setState('recording');
      return { ok: true, mime: chosen };
    },
    pause() {
      if (state !== 'recording' || !recorder) {
        return;
      }
      recorder.pause();
      clock.pause();
      setState('paused');
    },
    resume() {
      if (state !== 'paused' || !recorder) {
        return;
      }
      recorder.resume();
      clock.resume();
      setState('recording');
    },
    async stop() {
      if ((state !== 'recording' && state !== 'paused') || !recorder) {
        return { ok: false, reason: 'idle' };
      }
      setState('finalizing');
      const elapsedMs = clock.elapsed();
      const current = recorder;
      const done = new Promise<void>((resolve) => {
        stopWait = resolve;
      });
      current.stop();
      await done;
      if (!failed) {
        setState('completed');
      }
      return { ok: true, elapsedMs: clock.elapsed() || elapsedMs };
    },
  };
};
