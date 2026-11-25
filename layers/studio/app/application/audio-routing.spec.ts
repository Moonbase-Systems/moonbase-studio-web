import { describe, expect, it } from 'vitest';

import { measureTimeDomain, volumeToFaderDb } from '../models/audio.domain';
import { routeChannel, routeOverlayBus, sceneHasSolo } from './audio-routing';

describe('routeChannel', () => {
  it('sends an enabled channel to the program and keeps monitoring off the headphones', () => {
    expect(
      routeChannel({
        enabledInScene: true,
        monitoring: 'off',
        solo: false,
        anySoloInScene: false,
      }),
    ).toEqual({ program: true, monitor: false });
  });

  it('keeps a monitor-only channel off the program', () => {
    expect(
      routeChannel({
        enabledInScene: true,
        monitoring: 'monitor',
        solo: false,
        anySoloInScene: false,
      }),
    ).toEqual({ program: false, monitor: true });
  });

  it('sends monitor-and-output to both buses', () => {
    expect(
      routeChannel({
        enabledInScene: true,
        monitoring: 'monitor-and-output',
        solo: false,
        anySoloInScene: false,
      }),
    ).toEqual({ program: true, monitor: true });
  });

  it('does not let solo change the program send', () => {
    const withoutSolo = routeChannel({
      enabledInScene: true,
      monitoring: 'off',
      solo: false,
      anySoloInScene: false,
    });
    const whileAnotherIsSolo = routeChannel({
      enabledInScene: true,
      monitoring: 'off',
      solo: false,
      anySoloInScene: true,
    });
    const soloed = routeChannel({
      enabledInScene: true,
      monitoring: 'off',
      solo: true,
      anySoloInScene: true,
    });

    expect(withoutSolo.program).toBe(true);
    expect(whileAnotherIsSolo.program).toBe(true);
    expect(soloed.program).toBe(true);
    expect(whileAnotherIsSolo.monitor).toBe(false);
    expect(soloed.monitor).toBe(true);
  });

  it('leaves a channel that the active scene does not enable off both buses', () => {
    expect(
      routeChannel({
        enabledInScene: false,
        monitoring: 'monitor-and-output',
        solo: true,
        anySoloInScene: true,
      }),
    ).toEqual({ program: false, monitor: false });
  });

  it('counts solo only on channels the active scene enables', () => {
    expect(
      sceneHasSolo([
        { enabledInScene: false, solo: true },
        { enabledInScene: true, solo: false },
      ]),
    ).toBe(false);
    expect(sceneHasSolo([{ enabledInScene: true, solo: true }])).toBe(true);
  });
});

describe('routeOverlayBus', () => {
  it('keeps the program send and follows channel solo on the headphones', () => {
    const program = routeOverlayBus({ monitoring: 'off', solo: false, anyChannelSolo: false });
    expect(program).toEqual({ program: true, monitor: false });

    const withChannelSolo = routeOverlayBus({ monitoring: 'monitor-and-output', solo: false, anyChannelSolo: true });
    expect(withChannelSolo).toEqual({ program: true, monitor: false });

    const busSolo = routeOverlayBus({ monitoring: 'off', solo: true, anyChannelSolo: false });
    expect(busSolo).toEqual({ program: true, monitor: true });

    const bothSolo = routeOverlayBus({ monitoring: 'monitor', solo: true, anyChannelSolo: true });
    expect(bothSolo).toEqual({ program: false, monitor: true });
  });

  it('does not change a channel route when the overlay bus is not part of the solo count', () => {
    expect(
      routeChannel({
        enabledInScene: true,
        monitoring: 'monitor-and-output',
        solo: false,
        anySoloInScene: false,
      }),
    ).toEqual({ program: true, monitor: true });
  });
});

describe('level measurement', () => {
  it('maps silence to the floor and a half-scale sample to about -6 dB', () => {
    expect(measureTimeDomain([0, 0, 0, 0])).toEqual({ rmsDb: -60, peakDb: -60 });
    const half = measureTimeDomain([0.5, -0.5, 0.5, -0.5]);
    expect(half.rmsDb).toBeCloseTo(-6.02, 1);
    expect(half.peakDb).toBeCloseTo(-6.02, 1);
  });

  it('reports peak above RMS when one sample is louder', () => {
    const reading = measureTimeDomain([0, 0, 0, 1]);
    expect(reading.peakDb).toBeCloseTo(0, 5);
    expect(reading.rmsDb).toBeLessThan(reading.peakDb);
  });

  it('maps a closed legacy fader to -60 dB and unity to 0 dB', () => {
    expect(volumeToFaderDb(0)).toBe(-60);
    expect(volumeToFaderDb(1)).toBe(0);
    expect(volumeToFaderDb(0.5)).toBeCloseTo(-6.02, 1);
  });
});
