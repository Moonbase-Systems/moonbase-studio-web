import { describe, expect, it, vi } from 'vitest';

import { connectOverlaySends } from './audio-engine';
import { OverlayBufferCache } from './overlay-buffer-cache';
import { attachOverlayVoice } from './overlay-voice';

describe('overlay buffer cache', () => {
  it('decodes an asset once and retries after a failed decode', async () => {
    let calls = 0;
    const cache = new OverlayBufferCache(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('decode failed');
      }
      return { calls };
    });

    await expect(cache.load('asset:v1', 'blob:a')).rejects.toThrow('decode failed');
    const first = await cache.load('asset:v1', 'blob:a');
    const second = await cache.load('asset:v1', 'blob:a');
    expect(first).toBe(second);
    expect(calls).toBe(2);

    cache.retain(new Set());
    await cache.load('asset:v1', 'blob:a');
    expect(calls).toBe(3);
  });
});

describe('overlay voice', () => {
  it('disconnects the source and the gain when the voice ends or is stopped', () => {
    const source = {
      buffer: null as unknown,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    };
    const gain = {
      gain: {
        value: 1,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const ended = vi.fn();
    attachOverlayVoice({
      source,
      gain,
      destination: { kind: 'sum' },
      buffer: { kind: 'buffer' },
      volumeDb: 0,
      muted: false,
      loop: false,
      playbackRate: 1,
      startTimeSec: 0,
      now: 1,
      onEnded: ended,
    });

    source.onended?.();
    source.onended?.();
    expect(source.disconnect).toHaveBeenCalledTimes(1);
    expect(gain.disconnect).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledTimes(1);

    const stopped = {
      ...source,
      disconnect: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    };
    const stoppedGain = { ...gain, disconnect: vi.fn() };
    const voice = attachOverlayVoice({
      source: stopped,
      gain: stoppedGain,
      destination: { kind: 'sum' },
      buffer: { kind: 'buffer' },
      volumeDb: 0,
      muted: false,
      loop: false,
      playbackRate: 1,
      startTimeSec: 0,
      now: 2,
      onEnded: vi.fn(),
    });
    stopped.stop.mockImplementation(() => {
      stopped.onended?.();
    });
    voice.stop();
    expect(stopped.disconnect).toHaveBeenCalledTimes(1);
    expect(stoppedGain.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('connectOverlaySends', () => {
  it('feeds the master input and the monitor sum, not the program stream', () => {
    const programSend = { connect: vi.fn() };
    const monitorSend = { connect: vi.fn() };
    const masterInput = { name: 'master-input' };
    const monitorInput = { name: 'monitor-input' };
    const programStream = { name: 'program-stream' };

    connectOverlaySends(
      programSend,
      monitorSend,
      masterInput as unknown as AudioNode,
      monitorInput as unknown as AudioNode,
    );

    expect(programSend.connect).toHaveBeenCalledTimes(1);
    expect(programSend.connect).toHaveBeenCalledWith(masterInput);
    expect(monitorSend.connect).toHaveBeenCalledWith(monitorInput);
    expect(programSend.connect).not.toHaveBeenCalledWith(programStream);
    expect(monitorSend.connect).not.toHaveBeenCalledWith(programStream);
  });
});
