export type OutputPreset = {
  id: string;
  name: string;
  width: number;
  height: number;
  frameRate: number;
};

export type OutputProfile = {
  id: string;
  name: string;
  width: number;
  height: number;
  frameRate: number;
  /** Preset this profile was created from. Stays set after the numbers diverge. */
  originPresetId: string | null;
};

export type OutputFrame = {
  width: number;
  height: number;
  frameRate: number;
};

export const OUTPUT_PRESETS = [
  { id: 'youtube-1080p', name: 'YouTube 1080p', width: 1920, height: 1080, frameRate: 30 },
  { id: 'shorts-1080', name: 'Vertical 1080p', width: 1080, height: 1920, frameRate: 30 },
  { id: 'square-1080', name: 'Square 1080p', width: 1080, height: 1080, frameRate: 30 },
  { id: 'portrait-4x5', name: 'Portrait 4:5', width: 1080, height: 1350, frameRate: 30 },
] as const satisfies readonly OutputPreset[];

export type OutputPresetId = (typeof OUTPUT_PRESETS)[number]['id'];

const PRESET_BY_ID = new Map<string, OutputPreset>(OUTPUT_PRESETS.map((preset) => [preset.id, preset]));

export const outputPresetById = (id: string): OutputPreset | null => PRESET_BY_ID.get(id) ?? null;

/** Exact match on width, height and frame rate. Does not round. */
export const matchingOutputPreset = (frame: OutputFrame): OutputPreset | null =>
  OUTPUT_PRESETS.find(
    (preset) => preset.width === frame.width && preset.height === frame.height && preset.frameRate === frame.frameRate,
  ) ?? null;

const gcd = (left: number, right: number): number => {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b > 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
};

/** Display ratio, rounded only for the label. Comparison of profiles uses the raw numbers. */
export const formatAspectRatio = (width: number, height: number): string => {
  if (!(width > 0) || !(height > 0)) {
    return '';
  }
  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);
  const divisor = gcd(roundedWidth, roundedHeight);
  return `${roundedWidth / divisor}:${roundedHeight / divisor}`;
};

/** A new object every call. Projects must not share one profile record. */
export const createDefaultOutputProfile = (id: string): OutputProfile => {
  const preset = outputPresetById('youtube-1080p');
  if (!preset) {
    throw new Error('Missing youtube-1080p output preset');
  }
  return {
    id,
    name: preset.name,
    width: preset.width,
    height: preset.height,
    frameRate: preset.frameRate,
    originPresetId: preset.id,
  };
};

const fallbackFrame = (): OutputFrame => {
  const preset = outputPresetById('youtube-1080p');
  if (!preset) {
    return { width: 1920, height: 1080, frameRate: 30 };
  }
  return { width: preset.width, height: preset.height, frameRate: preset.frameRate };
};

/** Active output frame. Reads only `settings.outputProfile`. */
export const outputFrame = (
  project: { settings: { outputProfile?: OutputProfile | null } } | null | undefined,
): OutputFrame => {
  const profile = project?.settings.outputProfile;
  if (!profile) {
    return fallbackFrame();
  }
  return { width: profile.width, height: profile.height, frameRate: profile.frameRate };
};
