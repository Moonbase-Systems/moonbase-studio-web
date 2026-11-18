import { dbToGain } from '../../models/audio.domain';

export const OVERLAY_GAIN_RAMP_SEC = 0.02;

export type OverlayGainParam = {
  value: number;
  cancelScheduledValues: (time: number) => void;
  setValueAtTime: (value: number, time: number) => void;
  linearRampToValueAtTime: (value: number, time: number) => void;
};

export type OverlayVoiceSource = {
  buffer: unknown;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  playbackRate: { value: number };
  connect: (node: OverlayVoiceGain) => void;
  disconnect: () => void;
  start: (when: number, offset: number, duration?: number) => void;
  stop: () => void;
  onended: (() => void) | null;
};

export type OverlayVoiceGain = {
  gain: OverlayGainParam;
  connect: (node: unknown) => void;
  disconnect: () => void;
};

export const rampOverlayGain = (param: OverlayGainParam, value: number, now: number): void => {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + OVERLAY_GAIN_RAMP_SEC);
};

/**
 * One buffer source into the overlay sum. Stop and the natural end both disconnect the nodes.
 * `source.stop()` is what fires `onended` for a voice that was started.
 */
export const attachOverlayVoice = (input: {
  source: OverlayVoiceSource;
  gain: OverlayVoiceGain;
  destination: unknown;
  buffer: unknown;
  volumeDb: number;
  muted: boolean;
  loop: boolean;
  playbackRate: number;
  startTimeSec: number;
  endTimeSec?: number;
  now: number;
  onEnded: () => void;
}): { stop: () => void } => {
  const { source, gain } = input;
  source.buffer = input.buffer;
  source.loop = input.loop;
  source.playbackRate.value = input.playbackRate;
  if (input.loop && input.endTimeSec !== undefined) {
    source.loopStart = input.startTimeSec;
    source.loopEnd = input.endTimeSec;
  }
  gain.gain.setValueAtTime(input.muted ? 0 : dbToGain(input.volumeDb), input.now);
  source.connect(gain);
  gain.connect(input.destination);

  let closed = false;
  const finish = () => {
    if (closed) {
      return;
    }
    closed = true;
    source.disconnect();
    gain.disconnect();
    input.onEnded();
  };
  source.onended = finish;

  const duration = input.endTimeSec !== undefined ? input.endTimeSec - input.startTimeSec : undefined;
  if (duration !== undefined && duration > 0) {
    source.start(input.now, input.startTimeSec, duration);
  } else {
    source.start(input.now, input.startTimeSec);
  }

  return {
    stop: () => {
      if (closed) {
        return;
      }
      closed = true;
      source.disconnect();
      gain.disconnect();
      try {
        source.stop();
      } catch {
        // The node can already be stopped when the session and the engine both shut down.
      }
      input.onEnded();
    },
  };
};
