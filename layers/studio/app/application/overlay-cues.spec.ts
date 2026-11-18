import { describe, expect, it, vi } from 'vitest';

import { createDefaultOverlayBus, createOverlaySound } from '../models/overlay-sound.domain';
import { dispatchOverlayCue, soundsForOverlayCue, subscribeOverlayCues } from './overlay-cues';

describe('overlay cues', () => {
  it('plays only an enabled trigger for an enabled sound', () => {
    const bus = createDefaultOverlayBus();
    const live = createOverlaySound({ id: 'live', name: 'Live', assetId: 'a' });
    const quiet = createOverlaySound({ id: 'quiet', name: 'Quiet', assetId: 'a', enabled: false });
    bus.sounds = [live, quiet];
    bus.triggers = [
      { id: 'off', soundId: 'live', event: 'shown', enabled: false },
      { id: 'on', soundId: 'live', event: 'shown', enabled: true, sceneId: 'scene-a' },
      { id: 'other-scene', soundId: 'live', event: 'shown', enabled: true, sceneId: 'scene-b' },
      { id: 'disabled-sound', soundId: 'quiet', event: 'shown', enabled: true },
    ];

    expect(soundsForOverlayCue(bus, { event: 'shown', sceneId: 'scene-a' }).map((sound) => sound.id)).toEqual(['live']);
  });

  it('matches a follow alert the same way as a scene cue', () => {
    const bus = createDefaultOverlayBus();
    bus.sounds = [createOverlaySound({ id: 'sting', name: 'Sting', assetId: 'a' })];
    bus.triggers = [{ id: 'follow', soundId: 'sting', event: 'follow', enabled: true }];

    expect(soundsForOverlayCue(bus, { event: 'follow' }).map((sound) => sound.id)).toEqual(['sting']);
  });

  it('registers one listener once and drops it on unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeOverlayCues(listener);
    subscribeOverlayCues(listener);
    dispatchOverlayCue({ event: 'interaction' });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    dispatchOverlayCue({ event: 'interaction' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
