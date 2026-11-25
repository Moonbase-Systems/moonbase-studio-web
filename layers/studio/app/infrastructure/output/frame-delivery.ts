import type { FrameDelivery } from '../../ports/composition-engine';

export type { FrameDelivery };

export const emptyFrameDelivery = (width = 0, height = 0): FrameDelivery => ({
  deliveredFrames: 0,
  firstDeliveredAt: null,
  lastDeliveredAt: null,
  width,
  height,
});

/**
 * Frames copied onto the output canvas, not encoder output.
 * Null until two frames have a positive span.
 */
export const deliveredFramesPerSecond = (delivery: FrameDelivery): number | null => {
  if (delivery.firstDeliveredAt === null || delivery.lastDeliveredAt === null || delivery.deliveredFrames < 2) {
    return null;
  }
  const seconds = (delivery.lastDeliveredAt - delivery.firstDeliveredAt) / 1000;
  if (seconds <= 0) {
    return null;
  }
  return (delivery.deliveredFrames - 1) / seconds;
};
