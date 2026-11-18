import { describe, expect, it, vi } from 'vitest';

import { createOverlaySound } from '../models/overlay-sound.domain';
import { OverlayPlaybackController } from './overlay-playback-session';

const sound = createOverlaySound({
  id: 'sting',
  name: 'Sting',
  assetId: 'asset-1',
  maxInstances: 1,
  restartPolicy: 'queue',
});

describe('OverlayPlaybackController', () => {
  it('starts the next queued call when a voice ends', async () => {
    const loads: string[] = [];
    const started: string[] = [];
    const port = {
      loadBuffer: vi.fn(async (cacheKey: string) => {
        loads.push(cacheKey);
        return { cacheKey };
      }),
      start: vi.fn((request: { instanceId: string }) => {
        started.push(request.instanceId);
      }),
      stop: vi.fn(),
      setGain: vi.fn(),
      retain: vi.fn(),
    };
    let id = 0;
    const controller = new OverlayPlaybackController({
      port,
      now: () => 0,
      createId: () => `voice-${++id}`,
      resolve: () => ({ cacheKey: 'asset-1:key', url: 'blob:sting' }),
    });

    await controller.play(sound, 'scene-a', 16);
    await controller.play(sound, 'scene-a', 16);
    expect(controller.instances).toHaveLength(1);
    expect(loads).toEqual(['asset-1:key']);

    await controller.onEnded('voice-1', [sound], 16);
    expect(loads).toEqual(['asset-1:key', 'asset-1:key']);
    expect(started).toEqual(['voice-1', 'voice-2']);
    expect(controller.instances.map((item) => item.id)).toEqual(['voice-2']);
  });

  it('starts the queued call when the playing voice is stopped', async () => {
    const started: string[] = [];
    let id = 0;
    const controller = new OverlayPlaybackController({
      port: {
        loadBuffer: async () => ({}),
        start: (request) => {
          started.push(request.instanceId);
        },
        stop: vi.fn(),
        setGain: vi.fn(),
        retain: vi.fn(),
      },
      now: () => 0,
      createId: () => `voice-${++id}`,
      resolve: () => ({ cacheKey: 'asset-1:key', url: 'blob:sting' }),
    });

    await controller.play(sound, null, 16);
    await controller.play(sound, null, 16);
    await controller.stop('voice-1', [sound], 16);
    expect(started).toEqual(['voice-1', 'voice-2']);
    expect(controller.instances.map((item) => item.id)).toEqual(['voice-2']);
  });

  it('reports a missing file instead of throwing', async () => {
    const controller = new OverlayPlaybackController({
      port: {
        loadBuffer: vi.fn(async () => ({})),
        start: vi.fn(),
        stop: vi.fn(),
        setGain: vi.fn(),
        retain: vi.fn(),
      },
      now: () => 0,
      createId: () => 'voice',
      resolve: () => null,
    });

    await expect(controller.play(sound, null, 16)).resolves.toBe('missing-bytes');
  });

  it('drops a queued call when the sound is disabled', async () => {
    const controller = new OverlayPlaybackController({
      port: {
        loadBuffer: vi.fn(async () => ({})),
        start: vi.fn(),
        stop: vi.fn(),
        setGain: vi.fn(),
        retain: vi.fn(),
      },
      now: () => 0,
      createId: () => 'voice-1',
      resolve: () => ({ cacheKey: 'asset-1:key', url: 'blob:sting' }),
    });
    await controller.play(sound, null, 16);
    await controller.play(sound, null, 16);
    await controller.syncSounds([{ ...sound, enabled: false }]);
    expect(controller.instances).toEqual([]);
    await controller.onEnded('voice-1', [{ ...sound, enabled: false }], 16);
    expect(controller.instances).toEqual([]);
  });

  it('plays an alert file once and keeps it when the library is synced', async () => {
    const started: { volumeDb: number; loop: boolean; playbackRate: number }[] = [];
    let id = 0;
    const controller = new OverlayPlaybackController({
      port: {
        loadBuffer: vi.fn(async () => ({})),
        start: (request) => {
          started.push({ volumeDb: request.volumeDb, loop: request.loop, playbackRate: request.playbackRate });
        },
        stop: vi.fn(),
        setGain: vi.fn(),
        retain: vi.fn(),
      },
      now: () => 0,
      createId: () => `voice-${++id}`,
      resolve: () => null,
    });

    await expect(controller.playUrl('https://cdn.example/sting.mp3', 0, 'scene-a', 16)).resolves.toBe('started');
    await controller.syncSounds([]);
    expect(controller.instances).toEqual([{ id: 'voice-1', soundId: 'alert', sceneId: 'scene-a', alert: true }]);
    expect(started).toEqual([{ volumeDb: 0, loop: false, playbackRate: 1 }]);

    await expect(controller.playUrl('https://cdn.example/sting.mp3', 0, null, 1)).resolves.toBe('ignored');
    await expect(controller.playUrl('http://cdn.example/sting.mp3', 0, null, 16)).resolves.toBe('missing-bytes');
  });

  it('reports a decode failure for an alert file', async () => {
    const controller = new OverlayPlaybackController({
      port: {
        loadBuffer: vi.fn(async () => {
          throw new Error('decode');
        }),
        start: vi.fn(),
        stop: vi.fn(),
        setGain: vi.fn(),
        retain: vi.fn(),
      },
      now: () => 0,
      createId: () => 'voice',
      resolve: () => null,
    });

    await expect(controller.playUrl('https://cdn.example/sting.mp3', 0, null, 16)).resolves.toBe('decode-failed');
    expect(controller.instances).toEqual([]);
  });
});
