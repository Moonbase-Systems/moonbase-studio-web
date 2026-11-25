/** Video presets at 1920×1080. Other frames scale by pixel count. */
export const VIDEO_BITRATE_PRESETS = {
  low: 4_000_000,
  standard: 8_000_000,
  high: 12_000_000,
  veryHigh: 20_000_000,
} as const;

export type VideoBitratePreset = keyof typeof VIDEO_BITRATE_PRESETS;

export const AUDIO_BITRATE = 128_000;

const REFERENCE_PIXELS = 1920 * 1080;

export const videoBitrateForFrame = (preset: VideoBitratePreset, width: number, height: number): number => {
  const ratio = (width * height) / REFERENCE_PIXELS;
  return Math.max(1, Math.round(VIDEO_BITRATE_PRESETS[preset] * ratio));
};

/** Profile rates the recorder may request. Values are not rounded. */
export const RECORDING_FRAME_RATES = [24, 25, 29.97, 30, 50, 59.94, 60] as const;
