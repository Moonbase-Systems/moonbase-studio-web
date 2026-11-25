import { describe, expect, it, vi } from 'vitest';

import { createDefaultOverlayBus, createOverlaySound } from '../models/overlay-sound.domain';
import { playCueOnBus } from './overlay-cue-trace';
import type { OverlayAudioLogEntry, OverlayAudioStatus } from './overlay-event-port';
import { audioEntriesFromTrace } from './overlay-lab-log';
import { evaluateOverlayLabTest } from './overlay-lab-tests';

const status = (patch: Partial<OverlayAudioStatus> = {}): OverlayAudioStatus => ({
  engineReady: true,
  busMuted: false,
  busSolo: false,
  monitoring: 'off',
  program: true,
  monitor: false,
  faderDb: 0,
  rmsDb: -60,
  peakDb: -60,
  activeInstances: 0,
  queued: 0,
  lastSoundName: null,
  lastOutcome: null,
  masterMuted: false,
  masterVolume: 1,
  masterRmsDb: -60,
  effectCount: 0,
  chainError: null,
  ...patch,
});

const entry = (
  code: OverlayAudioLogEntry['code'],
  meta: OverlayAudioLogEntry['meta'] = {},
  detail = code,
): OverlayAudioLogEntry => ({
  id: `${code}-${detail}`,
  at: 1,
  code,
  status: code === 'playback-error' ? 'error' : 'ok',
  detail,
  meta,
});

describe('overlay lab trace', () => {
  it('plays the sound for a matching trigger and records a miss without calling play', async () => {
    const bus = createDefaultOverlayBus();
    bus.sounds = [createOverlaySound({ id: 'sting', name: 'Sting', assetId: 'asset' })];
    bus.triggers = [{ id: 'on', soundId: 'sting', event: 'follow', enabled: true }];
    const play = vi.fn(async () => 'started' as const);
    const trace = await playCueOnBus(bus, { event: 'follow' }, play, 20);
    expect(play).toHaveBeenCalledTimes(1);
    expect(audioEntriesFromTrace(trace).map((item) => item.code)).toEqual([
      'event-received',
      'trigger-matched',
      'playback-started',
    ]);

    const missed = await playCueOnBus(bus, { event: 'raid' }, play, 21);
    expect(play).toHaveBeenCalledTimes(1);
    expect(audioEntriesFromTrace(missed).map((item) => item.code)).toEqual(['event-received', 'trigger-miss']);
  });

  it('does not pass a test that only sent an event', () => {
    const log = [entry('event-received', { event: 'follow' })];
    expect(evaluateOverlayLabTest('play', { studioConnected: true, sent: 1, log, status: status() }).code).toBe(
      'no-trace',
    );
    expect(
      evaluateOverlayLabTest('play', {
        studioConnected: false,
        sent: 1,
        log: [entry('playback-started', { soundName: 'Sting' })],
        status: status(),
      }).code,
    ).toBe('studio-offline');
  });

  it('passes play only after a voice starts, and keeps loop as a listening check', () => {
    const started = [
      entry('event-received'),
      entry('trigger-matched'),
      entry('playback-started', {
        soundName: 'Sting',
        loop: false,
        restartPolicy: 'allow',
        cooldownMs: 0,
        maxInstances: 4,
      }),
    ];
    expect(
      evaluateOverlayLabTest('play', { studioConnected: true, sent: 1, log: started, status: status() }).state,
    ).toBe('pass');
    expect(evaluateOverlayLabTest('loop', { studioConnected: true, sent: 1, log: started, status: status() })).toEqual({
      state: 'manual',
      code: 'loop-off',
    });
  });

  it('measures mute, master, routing, and a full burst from the published status', () => {
    const started = [
      entry('event-received'),
      entry('playback-started', { cooldownMs: 500, maxInstances: 2, restartPolicy: 'restart', loop: true }),
    ];
    expect(
      evaluateOverlayLabTest('overlay-mute', {
        studioConnected: true,
        sent: 1,
        log: started,
        status: status({ busMuted: true, rmsDb: -60 }),
      }).code,
    ).toBe('mute-silenced');
    expect(
      evaluateOverlayLabTest('master-volume', {
        studioConnected: true,
        sent: 0,
        log: [],
        status: status({ masterVolume: 0.2 }),
      }).state,
    ).toBe('pass');
    expect(
      evaluateOverlayLabTest('monitoring', {
        studioConnected: true,
        sent: 0,
        log: [],
        status: status({ monitoring: 'monitor', program: false, monitor: true }),
      }).code,
    ).toBe('monitor-on');
    const burst = Array.from({ length: 8 }, () => entry('event-received')).concat([
      entry('playback-started', { maxInstances: 2 }),
      entry('playback-ignored'),
    ]);
    expect(evaluateOverlayLabTest('rapid', { studioConnected: true, sent: 8, log: burst, status: status() }).code).toBe(
      'rapid-handled',
    );
    expect(
      evaluateOverlayLabTest('max-instances', { studioConnected: true, sent: 8, log: burst, status: status() }).code,
    ).toBe('instances-capped');
  });
});
