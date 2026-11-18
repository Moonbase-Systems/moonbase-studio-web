import type { OverlayBus, OverlayCueEvent, OverlaySound } from '../models/overlay-sound.domain';

export type OverlayCue = {
  event: OverlayCueEvent;
  sceneId?: string;
  elementId?: string;
};

type OverlayCueListener = (cue: OverlayCue) => void;

const listeners = new Set<OverlayCueListener>();

export const dispatchOverlayCue = (cue: OverlayCue): void => {
  for (const listener of listeners) {
    listener(cue);
  }
};

/** One function is one subscription. A second subscribe of the same listener does not double the call. */
export const subscribeOverlayCues = (listener: OverlayCueListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const soundsForOverlayCue = (bus: OverlayBus, cue: OverlayCue): OverlaySound[] => {
  const sounds = new Map(bus.sounds.map((sound) => [sound.id, sound]));
  const matched: OverlaySound[] = [];
  for (const trigger of bus.triggers) {
    if (!trigger.enabled || trigger.event !== cue.event) {
      continue;
    }
    if (trigger.sceneId && trigger.sceneId !== cue.sceneId) {
      continue;
    }
    if (trigger.elementId && trigger.elementId !== cue.elementId) {
      continue;
    }
    const sound = sounds.get(trigger.soundId);
    if (!sound?.enabled) {
      continue;
    }
    matched.push(sound);
  }
  return matched;
};
