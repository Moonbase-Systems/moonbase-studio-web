export type OutputFrameSize = {
  width: number;
  height: number;
};

export type OutputCanvasSize = {
  width: number;
  height: number;
};

/**
 * Sizes the recording canvas to the output profile.
 * The editor host is not an input: panel size must not change the bitmap.
 */
export const sizeOutputCanvas = (canvas: OutputCanvasSize, frame: OutputFrameSize): void => {
  canvas.width = Math.max(1, Math.round(frame.width));
  canvas.height = Math.max(1, Math.round(frame.height));
};
