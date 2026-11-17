import { describe, expect, it } from 'vitest';

import {
  chainLatencyMs,
  createAudioEffect,
  defaultEqBandParameters,
  effectLatencyMs,
  effectPathSignature,
  effectsInSignalPath,
  moveAudioEffect,
  resetAudioEffect,
} from './audio-effect.domain';
import { AUDIO_PRESET_FORMAT_VERSION, presetRejection, SYSTEM_CHANNEL_PRESETS } from './audio-preset.domain';

describe('audio effect model', () => {
  it('keeps enabled effects in chain order and drops a bypassed effect', () => {
    const eq = createAudioEffect({ id: 'eq', type: 'eq-band' });
    const gate = { ...createAudioEffect({ id: 'gate', type: 'noise-gate' }), enabled: false };
    const highPass = createAudioEffect({ id: 'hpf', type: 'high-pass' });
    const chain = [eq, gate, highPass];

    expect(effectsInSignalPath(chain).map((effect) => effect.id)).toEqual(['eq', 'hpf']);
    expect(effectPathSignature(chain)).toBe('eq:eq-band>hpf:high-pass');
    expect(effectPathSignature([{ ...eq, parameters: { ...eq.parameters, gainDb: 3 } }, highPass])).toBe(
      effectPathSignature([eq, highPass]),
    );
  });

  it('moves an effect to the requested index and resets parameters without a new id', () => {
    const first = createAudioEffect({ id: 'a', type: 'eq-band' });
    const second = createAudioEffect({ id: 'b', type: 'compressor' });
    const third = createAudioEffect({ id: 'c', type: 'limiter' });
    expect(moveAudioEffect([first, second, third], 'a', 2)?.map((effect) => effect.id)).toEqual(['b', 'c', 'a']);
    expect(moveAudioEffect([first], 'missing', 0)).toBeNull();

    const edited = { ...first, parameters: { ...first.parameters, gainDb: 6 } };
    const reset = resetAudioEffect(edited);
    expect(reset.id).toBe('a');
    expect(reset.parameters).toEqual(defaultEqBandParameters());
  });

  it('reports lookahead only on the limiter', () => {
    const limiter = createAudioEffect({ id: 'lim', type: 'limiter' });
    const eq = createAudioEffect({ id: 'eq', type: 'eq-band' });
    expect(effectLatencyMs(limiter)).toBe(limiter.parameters.lookaheadMs);
    expect(effectLatencyMs(eq)).toBe(0);
    expect(chainLatencyMs([limiter, { ...eq, enabled: false }])).toBe(5);
  });

  it('rejects a preset with the wrong version or kind', () => {
    expect(presetRejection({ formatVersion: 2, kind: 'channel' }, 'channel')).toBe('version');
    expect(presetRejection({ formatVersion: AUDIO_PRESET_FORMAT_VERSION, kind: 'effect' }, 'channel')).toBe('kind');
    expect(SYSTEM_CHANNEL_PRESETS.map((preset) => preset.id)).toContain('system:clean-voice');
    expect(SYSTEM_CHANNEL_PRESETS.every((preset) => preset.formatVersion === 1)).toBe(true);
  });
});
