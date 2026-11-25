import { describe, expect, it, vi } from 'vitest';

import {
  disarmBrowserProcessing,
  rawMicrophoneConstraints,
  rawSystemAudioConstraints,
  rawTabAudioConstraints,
} from './raw-capture';

describe('raw capture constraints', () => {
  it('asks for the microphone without voice processing or a forced mono count', () => {
    expect(rawMicrophoneConstraints('mic-a')).toEqual({
      deviceId: { exact: 'mic-a' },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      voiceIsolation: false,
    });
    expect(rawMicrophoneConstraints()).not.toHaveProperty('channelCount');
    expect(rawMicrophoneConstraints()).not.toHaveProperty('deviceId');
  });

  it('asks for system and tab audio without voice processing', () => {
    expect(rawSystemAudioConstraints()).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      voiceIsolation: false,
    });
    expect(rawTabAudioConstraints()).toMatchObject({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      voiceIsolation: false,
      suppressLocalAudioPlayback: true,
      restrictOwnAudio: true,
    });
  });

  it('marks a live track as music and repeats the processing flags', async () => {
    const applyConstraints = vi.fn(async () => undefined);
    const track = { contentHint: '', applyConstraints };
    await disarmBrowserProcessing([track]);
    expect(track.contentHint).toBe('music');
    expect(applyConstraints).toHaveBeenCalledWith({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      voiceIsolation: false,
    });
  });

  it('keeps the track when the browser rejects the repeated request', async () => {
    const track = {
      contentHint: '',
      applyConstraints: vi.fn(async () => {
        throw new Error('overconstrained');
      }),
    };
    await expect(disarmBrowserProcessing([track])).resolves.toBeUndefined();
    expect(track.contentHint).toBe('music');
  });
});
