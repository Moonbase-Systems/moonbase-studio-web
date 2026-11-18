import { describe, expect, it } from 'vitest';

import { createOverlaySound } from '../models/overlay-sound.domain';
import {
  acceptOverlayPlay,
  clearOverlayQueue,
  decideOverlayPlay,
  emptyOverlayPlaybackBook,
  noteOverlayInstance,
  overlayStopsForSceneChange,
  stopAllOverlayPlayback,
  takeQueuedOverlay,
} from './overlay-playback';

const sound = (patch: Partial<Parameters<typeof createOverlaySound>[0]> = {}) =>
  createOverlaySound({ id: 'sting', name: 'Sting', assetId: 'asset-1', ...patch });

describe('decideOverlayPlay', () => {
  it('layers voices until the sound limit and then ignores them', () => {
    const playing = sound({ maxInstances: 2, restartPolicy: 'allow' });
    let book = emptyOverlayPlaybackBook();
    const first = decideOverlayPlay({ book, sound: playing, busMaxInstances: 16, nowMs: 0, sceneId: null });
    expect(first).toEqual({ kind: 'start', stopInstanceIds: [] });
    book = noteOverlayInstance(acceptOverlayPlay(book, playing.id, 0, null, first), {
      id: 'a',
      soundId: playing.id,
      sceneId: null,
    });
    const second = decideOverlayPlay({ book, sound: playing, busMaxInstances: 16, nowMs: 10, sceneId: null });
    book = noteOverlayInstance(acceptOverlayPlay(book, playing.id, 10, null, second), {
      id: 'b',
      soundId: playing.id,
      sceneId: null,
    });
    expect(decideOverlayPlay({ book, sound: playing, busMaxInstances: 16, nowMs: 20, sceneId: null })).toEqual({
      kind: 'ignore',
    });
  });

  it('stops the previous voices of a restart and starts one', () => {
    const playing = sound({ restartPolicy: 'restart' });
    const book = noteOverlayInstance(emptyOverlayPlaybackBook(), {
      id: 'old',
      soundId: playing.id,
      sceneId: 'scene-a',
    });
    expect(decideOverlayPlay({ book, sound: playing, busMaxInstances: 16, nowMs: 0, sceneId: null })).toEqual({
      kind: 'start',
      stopInstanceIds: ['old'],
    });
  });

  it('does not restart when every other voice already fills the bus', () => {
    const playing = sound({ restartPolicy: 'restart' });
    const book = emptyOverlayPlaybackBook();
    book.instances = [{ id: 'other', soundId: 'other', sceneId: null }];
    expect(decideOverlayPlay({ book, sound: playing, busMaxInstances: 1, nowMs: 0, sceneId: null })).toEqual({
      kind: 'ignore',
    });
  });

  it('ignores a new call while an ignore-policy sound is already playing', () => {
    const playing = sound({ restartPolicy: 'ignore' });
    const book = noteOverlayInstance(emptyOverlayPlaybackBook(), {
      id: 'live',
      soundId: playing.id,
      sceneId: null,
    });
    expect(decideOverlayPlay({ book, sound: playing, busMaxInstances: 16, nowMs: 0, sceneId: null })).toEqual({
      kind: 'ignore',
    });
  });

  it('queues above the limit and refuses a ninth waiting call', () => {
    const playing = sound({ maxInstances: 1, restartPolicy: 'queue' });
    let book = noteOverlayInstance(emptyOverlayPlaybackBook(), {
      id: 'live',
      soundId: playing.id,
      sceneId: null,
    });
    for (let index = 0; index < 8; index += 1) {
      const decision = decideOverlayPlay({
        book,
        sound: playing,
        busMaxInstances: 16,
        nowMs: index,
        sceneId: null,
      });
      expect(decision.kind).toBe('queue');
      book = acceptOverlayPlay(book, playing.id, index, null, decision);
    }
    expect(decideOverlayPlay({ book, sound: playing, busMaxInstances: 16, nowMs: 9, sceneId: null })).toEqual({
      kind: 'ignore',
    });
    const released = { ...book, instances: [] };
    const next = takeQueuedOverlay(released, playing, 16);
    expect(next.entry?.soundId).toBe(playing.id);
    expect(next.book.queues[playing.id]).toHaveLength(7);
  });

  it('rejects a call inside the cooldown before a voice or a queue entry exists', () => {
    const playing = sound({ cooldownMs: 1000, restartPolicy: 'queue', maxInstances: 1 });
    const book = {
      ...emptyOverlayPlaybackBook(),
      lastTriggerAtMs: { [playing.id]: 500 },
      instances: [{ id: 'live', soundId: playing.id, sceneId: null }],
    };
    expect(decideOverlayPlay({ book, sound: playing, busMaxInstances: 16, nowMs: 1000, sceneId: null })).toEqual({
      kind: 'ignore',
    });
    expect(book.queues[playing.id]).toBeUndefined();
  });

  it('clears the queue on stop all and keeps a manual voice across a scene change', () => {
    const book = noteOverlayInstance(emptyOverlayPlaybackBook(), {
      id: 'manual',
      soundId: 'sting',
      sceneId: null,
    });
    const queued = acceptOverlayPlay(book, 'sting', 0, 'scene-a', { kind: 'queue' });
    const stopped = stopAllOverlayPlayback(queued);
    expect(stopped.stoppedIds).toEqual(['manual']);
    expect(stopped.book.queues).toEqual({});

    const sceneStop = overlayStopsForSceneChange('stop-scene-sounds', queued, 'scene-a');
    expect(sceneStop.stoppedIds).toEqual([]);
    expect(sceneStop.book.instances.map((item) => item.id)).toEqual(['manual']);
    expect(sceneStop.book.queues.sting).toEqual([]);
    expect(overlayStopsForSceneChange('continue', queued, 'scene-a').stoppedIds).toEqual([]);
    expect(clearOverlayQueue(queued, 'sting').queues.sting).toEqual([]);
  });
});
