import type { ProjectVideoSettings } from '../models/project.domain';

export type CaptureFrame = { width: number; height: number; frameRate: number };

export const BACKGROUND_PREVIEW_LONG_EDGE = 960;
export const BACKGROUND_PREVIEW_FRAME_RATE = 15;

const evenPixels = (value: number): number => Math.max(2, Math.round(value / 2) * 2);

/** Ceiling that keeps a capture at the project's output size and frame rate. */
export const projectCaptureFrame = (video: ProjectVideoSettings): CaptureFrame => ({
  width: evenPixels(video.width),
  height: evenPixels(video.height),
  frameRate: Math.max(1, video.frameRate),
});

/** Smaller ceiling for when nothing is recording and the studio window is in the background. */
export const backgroundCaptureFrame = (video: ProjectVideoSettings): CaptureFrame => {
  const project = projectCaptureFrame(video);
  const scale = Math.min(1, BACKGROUND_PREVIEW_LONG_EDGE / Math.max(project.width, project.height));
  return {
    width: evenPixels(project.width * scale),
    height: evenPixels(project.height * scale),
    frameRate: Math.min(BACKGROUND_PREVIEW_FRAME_RATE, project.frameRate),
  };
};

/** Upper bounds only: `getDisplayMedia` rejects `min` and `exact`, and the browser keeps the surface's aspect ratio. */
export const captureConstraints = (frame: CaptureFrame): MediaTrackConstraints => ({
  width: { max: frame.width },
  height: { max: frame.height },
  frameRate: { max: frame.frameRate },
});
