import type { OverlayBus, OverlaySound } from '../models/overlay-sound.domain';
import { type OverlayCue, soundsForOverlayCue } from './overlay-cues';
import type { OverlayPlayOutcome } from './overlay-playback-session';

export type OverlayCueOutcome = {
  soundId: string;
  name: string;
  outcome: OverlayPlayOutcome;
  loop: boolean;
  restartPolicy: OverlaySound['restartPolicy'];
  cooldownMs: number;
  maxInstances: number;
};

export type OverlayCueTrace = {
  at: number;
  event: OverlayCue['event'];
  matched: number;
  outcomes: OverlayCueOutcome[];
};

export type OverlayPlaybackNotice = {
  at: number;
  soundId: string;
  soundName: string;
};

type TraceListener = (trace: OverlayCueTrace) => void;
type NoticeListener = (notice: OverlayPlaybackNotice) => void;

const traces = new Set<TraceListener>();
const notices = new Set<NoticeListener>();

export const publishOverlayCueTrace = (trace: OverlayCueTrace): void => {
  for (const listener of traces) {
    listener(trace);
  }
};

export const subscribeOverlayCueTrace = (listener: TraceListener): (() => void) => {
  traces.add(listener);
  return () => {
    traces.delete(listener);
  };
};

export const publishOverlayPlaybackNotice = (notice: OverlayPlaybackNotice): void => {
  for (const listener of notices) {
    listener(notice);
  }
};

export const subscribeOverlayPlaybackNotice = (listener: NoticeListener): (() => void) => {
  notices.add(listener);
  return () => {
    notices.delete(listener);
  };
};

/**
 * Match the cue with the project triggers, then start each sound through the session player.
 * The player is the existing overlay controller. This function does not touch Web Audio.
 */
export const playCueOnBus = async (
  bus: OverlayBus,
  cue: OverlayCue,
  play: (sound: OverlaySound) => Promise<OverlayPlayOutcome>,
  now = Date.now(),
): Promise<OverlayCueTrace> => {
  const matched = soundsForOverlayCue(bus, cue);
  const outcomes: OverlayCueOutcome[] = [];
  for (const sound of matched) {
    let outcome: OverlayPlayOutcome;
    try {
      outcome = await play(sound);
    } catch {
      outcome = 'decode-failed';
    }
    outcomes.push({
      soundId: sound.id,
      name: sound.name,
      outcome,
      loop: sound.loop,
      restartPolicy: sound.restartPolicy,
      cooldownMs: sound.cooldownMs,
      maxInstances: sound.maxInstances,
    });
  }
  return { at: now, event: cue.event, matched: matched.length, outcomes };
};
