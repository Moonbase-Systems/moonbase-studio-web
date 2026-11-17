import { describe, expect, it, vi } from 'vitest';

import { createAudioEffect } from '../../../models/audio-effect.domain';
import { type BuiltEffect, EffectInsert, type EffectInsertHost } from './effect-insert';

const createHost = () => {
  const built: BuiltEffect[] = [];
  const after: Array<() => void> = [];
  const inputDisconnect = vi.fn();
  let gains = 0;
  const createGain = () => {
    gains += 1;
    const gain = {
      gain: {
        value: 1,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: gains === 1 ? inputDisconnect : vi.fn(),
    };
    return gain as unknown as GainNode;
  };
  const host: EffectInsertHost = {
    now: () => 0,
    createGain,
    build: vi.fn(async (effect) => {
      const item: BuiltEffect = {
        id: effect.id,
        input: { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode,
        output: { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode,
        latencyMs: effect.type === 'limiter' ? effect.parameters.lookaheadMs : 0,
        update: vi.fn(),
        reductionDb: () => (effect.type === 'compressor' ? -4 : null),
        dispose: vi.fn(),
      };
      built.push(item);
      return item;
    }),
    after: (_ms, fn) => {
      after.push(fn);
    },
  };
  return { host, built, after, inputDisconnect };
};

describe('effect insert', () => {
  it('builds only enabled effects and leaves the insert input connected', async () => {
    const { host, built, inputDisconnect } = createHost();
    const insert = new EffectInsert(host);
    const input = insert.input;
    const eq = createAudioEffect({ id: 'eq', type: 'eq-band' });
    const bypassed = { ...createAudioEffect({ id: 'gate', type: 'noise-gate' }), enabled: false };

    await insert.sync([eq, bypassed]);

    expect(host.build).toHaveBeenCalledTimes(1);
    expect(built.map((item) => item.id)).toEqual(['eq']);
    expect(insert.input).toBe(input);
    expect(inputDisconnect).not.toHaveBeenCalled();
  });

  it('updates parameters in place when the path does not change', async () => {
    const { host, built } = createHost();
    const insert = new EffectInsert(host);
    const eq = createAudioEffect({ id: 'eq', type: 'eq-band' });
    await insert.sync([eq]);
    const edited = { ...eq, parameters: { ...eq.parameters, gainDb: 3 } };
    await insert.sync([edited]);
    expect(host.build).toHaveBeenCalledTimes(1);
    expect(built[0]?.update).toHaveBeenCalledWith(edited);
  });

  it('drops a bypassed effect from the path and disposes the old processor after the crossfade', async () => {
    const { host, built, after } = createHost();
    const insert = new EffectInsert(host);
    const eq = createAudioEffect({ id: 'eq', type: 'eq-band' });
    await insert.sync([eq]);
    await insert.sync([{ ...eq, enabled: false }]);
    expect(host.build).toHaveBeenCalledTimes(1);
    for (const callback of after) {
      callback();
    }
    expect(built[0]?.dispose).toHaveBeenCalled();
  });
});
