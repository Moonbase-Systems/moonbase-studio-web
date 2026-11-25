import { describe, expect, it } from 'vitest';

import { type CaptureStream, type CaptureTrack, createOutputCapture } from './output-capture';

const track = (kind: string): CaptureTrack & { stopped: boolean; cloned: boolean } => {
  const value = {
    kind,
    stopped: false,
    cloned: false,
    stop() {
      value.stopped = true;
    },
    clone() {
      value.cloned = true;
      return track(kind);
    },
  };
  return value;
};

const streamOf = (tracks: CaptureTrack[]): CaptureStream => ({
  getVideoTracks: () => tracks.filter((item) => item.kind === 'video'),
  getAudioTracks: () => tracks.filter((item) => item.kind === 'audio'),
});

describe('createOutputCapture', () => {
  it('copies program audio and stops only the capture video track and the clone', () => {
    const video = track('video');
    const programAudio = track('audio');
    let capturedRate = 0;
    const capture = createOutputCapture({
      getCanvas: () => ({
        captureStream: (frameRate) => {
          capturedRate = frameRate;
          return streamOf([video]);
        },
      }),
      getFrameRate: () => 29.97,
      getProgramStream: () => streamOf([programAudio]),
      createStream: (videoTrack, audioTrack) => streamOf(audioTrack ? [videoTrack, audioTrack] : [videoTrack]),
    });

    expect(capture.open()).toEqual({ ok: true });
    expect(capturedRate).toBe(29.97);
    expect(capture.hasAudio).toBe(true);
    expect(programAudio.cloned).toBe(true);
    expect(programAudio.stopped).toBe(false);
    capture.markCapturing();
    expect(capture.state).toBe('capturing');
    capture.dispose();
    expect(video.stopped).toBe(true);
    expect(programAudio.stopped).toBe(false);
    expect(capture.state).toBe('disposed');
    expect(capture.open()).toEqual({ ok: false, reason: 'disposed' });
  });

  it('does not restart when the caller opens an active capture again', () => {
    let opens = 0;
    const capture = createOutputCapture({
      getCanvas: () => ({
        captureStream: () => {
          opens += 1;
          return streamOf([track('video')]);
        },
      }),
      getFrameRate: () => 30,
      getProgramStream: () => null,
      createStream: (videoTrack) => streamOf([videoTrack]),
    });
    capture.open();
    capture.markCapturing();
    expect(capture.open()).toEqual({ ok: true });
    expect(opens).toBe(1);
    expect(capture.state).toBe('capturing');
  });
});
