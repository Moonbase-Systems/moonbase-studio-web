export type CaptureState = 'idle' | 'initializing' | 'ready' | 'capturing' | 'stopping' | 'disposed';

export type CaptureTrack = {
  kind: string;
  stop: () => void;
  clone: () => CaptureTrack;
};

export type CaptureStream = {
  getVideoTracks: () => CaptureTrack[];
  getAudioTracks: () => CaptureTrack[];
};

export type OutputCanvasSource = {
  captureStream: (frameRate: number) => CaptureStream;
};

export type OutputCapture = {
  readonly state: CaptureState;
  readonly stream: CaptureStream | null;
  readonly requestedFrameRate: number | null;
  readonly hasAudio: boolean;
  open(): { ok: true } | { ok: false; reason: 'disposed' | 'canvas' | 'video' };
  markCapturing(): void;
  stop(): void;
  dispose(): void;
};

export type OutputCaptureOptions = {
  getCanvas: () => OutputCanvasSource | null;
  getFrameRate: () => number;
  getProgramStream: () => CaptureStream | null;
  /** Builds the stream handed to the recorder. Tests supply a fake. */
  createStream?: (video: CaptureTrack, audio: CaptureTrack | null) => CaptureStream;
};

/**
 * One MediaStream for the recorder: output-canvas video plus a clone of the program-mix audio track.
 * The clone is not connected to the speakers. Dispose stops the capture video track and the clone only.
 */
export const createOutputCapture = (options: OutputCaptureOptions): OutputCapture => {
  let state: CaptureState = 'idle';
  let stream: CaptureStream | null = null;
  let videoTrack: CaptureTrack | null = null;
  let audioClone: CaptureTrack | null = null;
  let requestedFrameRate: number | null = null;
  let hasAudio = false;

  const stopOwnedTracks = (): void => {
    videoTrack?.stop();
    audioClone?.stop();
    videoTrack = null;
    audioClone = null;
    stream = null;
    hasAudio = false;
  };

  return {
    get state() {
      return state;
    },
    get stream() {
      return stream;
    },
    get requestedFrameRate() {
      return requestedFrameRate;
    },
    get hasAudio() {
      return hasAudio;
    },
    open() {
      if (state === 'disposed') {
        return { ok: false, reason: 'disposed' };
      }
      if (state === 'ready' || state === 'capturing') {
        return { ok: true };
      }
      state = 'initializing';
      const canvas = options.getCanvas();
      if (!canvas) {
        state = 'idle';
        return { ok: false, reason: 'canvas' };
      }
      const frameRate = options.getFrameRate();
      requestedFrameRate = frameRate;
      const captured = canvas.captureStream(frameRate);
      const video = captured.getVideoTracks()[0];
      if (!video) {
        state = 'idle';
        return { ok: false, reason: 'video' };
      }
      videoTrack = video;
      const programAudio = options.getProgramStream()?.getAudioTracks()[0];
      audioClone = programAudio ? programAudio.clone() : null;
      hasAudio = audioClone !== null;
      const createStream =
        options.createStream ??
        ((videoTrackIn: CaptureTrack, audioTrack: CaptureTrack | null) => {
          const tracks = audioTrack ? [videoTrackIn, audioTrack] : [videoTrackIn];
          return new MediaStream(tracks as unknown as MediaStreamTrack[]);
        });
      stream = createStream(video, audioClone);
      state = 'ready';
      return { ok: true };
    },
    markCapturing() {
      if (state === 'ready') {
        state = 'capturing';
      }
    },
    stop() {
      if (state !== 'capturing' && state !== 'ready' && state !== 'initializing') {
        return;
      }
      state = 'stopping';
      stopOwnedTracks();
      state = 'idle';
    },
    dispose() {
      if (state === 'disposed') {
        return;
      }
      stopOwnedTracks();
      state = 'disposed';
    },
  };
};
