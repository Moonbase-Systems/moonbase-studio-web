import { describe, expect, it } from 'vitest';

import { type AudioDevicePort, AudioDeviceSession, type DeviceTrack } from './audio-devices';

class FakeTrack implements DeviceTrack {
  readyState = 'live';
  private readonly listeners = new Set<() => void>();

  stop(): void {
    if (this.readyState === 'ended') {
      return;
    }
    this.readyState = 'ended';
    for (const listener of this.listeners) {
      listener();
    }
  }

  addEventListener(_type: 'ended', listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'ended', listener: () => void): void {
    this.listeners.delete(listener);
  }
}

const port = (options?: {
  fail?: Error;
  devices?: AudioDevicePort['enumerateDevices'];
}): AudioDevicePort & {
  streams: FakeTrack[][];
} => {
  const streams: FakeTrack[][] = [];
  return {
    streams,
    enumerateDevices:
      options?.devices ?? (async () => [{ deviceId: 'mic-a', kind: 'audioinput', label: '', groupId: 'g' }]),
    getUserMedia: async () => {
      if (options?.fail) {
        throw options.fail;
      }
      const track = new FakeTrack();
      streams.push([track]);
      return {
        getAudioTracks: () => [track],
        getTracks: () => [track],
      };
    },
    addDeviceChangeListener: () => undefined,
    removeDeviceChangeListener: () => undefined,
  };
};

describe('audio device session', () => {
  it('treats an unnamed list as hidden labels, not a device error', async () => {
    const devices = new AudioDeviceSession(port());
    await devices.refresh();
    const snapshot = devices.snapshot();
    expect(snapshot.labelsHidden).toBe(true);
    expect(snapshot.permission).toBe('unknown');
    expect(snapshot.inputs[0]?.status).toBe('available');
    expect(snapshot.inputs[0]?.error).toBeNull();
  });

  it('replaces the microphone on the same source and keeps that source when the track ends', async () => {
    const replaced = new AudioDeviceSession(port());
    await replaced.refresh();
    const first = await replaced.startMicrophone('src-1', 'mic-a');
    const firstTrack = first.getAudioTracks()[0]!;
    const second = await replaced.startMicrophone('src-1', 'mic-a');
    expect(firstTrack.readyState).toBe('ended');
    replaced.releaseTracks('src-1', first.getAudioTracks());
    expect(second.getAudioTracks()[0]?.readyState).toBe('live');
    expect(replaced.snapshot().inputs[0]?.status).toBe('active');
    expect(replaced.ownedSourceIds()).toEqual(['src-1']);

    const ended = new AudioDeviceSession(port());
    await ended.refresh();
    const stream = await ended.startMicrophone('src-1', 'mic-a');
    stream.getAudioTracks()[0]?.stop();
    expect(ended.snapshot().inputs.find((device) => device.deviceId === 'mic-a')?.status).toBe('disconnected');
    expect(ended.ownedSourceIds()).toEqual(['src-1']);
  });

  it('records a start error without marking a permission refusal as a broken device', async () => {
    const denied = new AudioDeviceSession(port({ fail: Object.assign(new Error('no'), { name: 'NotAllowedError' }) }));
    await denied.refresh();
    await expect(denied.startMicrophone('src-1', 'mic-a')).rejects.toThrow('no');
    expect(denied.snapshot().permission).toBe('denied');
    expect(denied.snapshot().inputs[0]?.status).not.toBe('start-error');

    const broken = new AudioDeviceSession(port({ fail: new Error('device busy') }));
    await broken.refresh();
    await expect(broken.startMicrophone('src-1', 'mic-a')).rejects.toThrow('device busy');
    expect(broken.snapshot().inputs[0]?.status).toBe('start-error');
  });
});
