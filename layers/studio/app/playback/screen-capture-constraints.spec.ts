import { describe, expect, it } from 'vitest';

import { backgroundCaptureFrame, captureConstraints, projectCaptureFrame } from './screen-capture-constraints';

describe('screen capture constraints', () => {
  it('caps a landscape capture at the project size and shrinks it in the background', () => {
    const video = { width: 1920, height: 1080, frameRate: 30 };

    expect(projectCaptureFrame(video)).toEqual({ width: 1920, height: 1080, frameRate: 30 });
    expect(backgroundCaptureFrame(video)).toEqual({ width: 960, height: 540, frameRate: 15 });
    expect(captureConstraints(projectCaptureFrame(video))).toEqual({
      width: { max: 1920 },
      height: { max: 1080 },
      frameRate: { max: 30 },
    });
  });

  it('keeps a portrait project upright and its long edge at 960 in the background', () => {
    expect(backgroundCaptureFrame({ width: 1080, height: 1920, frameRate: 60 })).toEqual({
      width: 540,
      height: 960,
      frameRate: 15,
    });
  });

  it('never raises a small project or a slow frame rate in the background', () => {
    expect(backgroundCaptureFrame({ width: 640, height: 360, frameRate: 10 })).toEqual({
      width: 640,
      height: 360,
      frameRate: 10,
    });
  });
});
