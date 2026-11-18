import { createDefaultOutputProfile, matchingOutputPreset } from '../models/output-profile.domain';

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const positiveFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const profileName = (width: number, height: number, frameRate: number, presetName: string | null): string => {
  if (presetName) {
    return presetName;
  }
  return `${width}×${height} @ ${frameRate}`;
};

/**
 * Lifts `settings.video` width, height and frame rate into `settings.outputProfile`.
 * Runs only for formatVersion 3. A saved v4 file never reaches this step, so its profile id stays put.
 */
export const migrateProjectFileV3ToV4 = (raw: unknown, generateId: () => string): unknown => {
  if (!isRecord(raw) || raw.formatVersion !== 3) {
    return raw;
  }

  const file: JsonRecord = structuredClone(raw);
  file.formatVersion = 4;

  const project = file.project;
  if (!isRecord(project) || !isRecord(project.settings)) {
    return file;
  }

  const settings = project.settings;
  const existing = settings.outputProfile;
  if (isRecord(existing) && typeof existing.id === 'string' && existing.id.length > 0) {
    return file;
  }

  const video = isRecord(settings.video) ? { ...settings.video } : {};
  const width = video.width;
  const height = video.height;
  const frameRate = video.frameRate;
  delete video.width;
  delete video.height;
  delete video.frameRate;
  settings.video = video;

  if (positiveFinite(width) && positiveFinite(height) && positiveFinite(frameRate)) {
    const preset = matchingOutputPreset({ width, height, frameRate });
    settings.outputProfile = {
      id: generateId(),
      name: profileName(width, height, frameRate, preset?.name ?? null),
      width,
      height,
      frameRate,
      originPresetId: preset?.id ?? null,
    };
    return file;
  }

  settings.outputProfile = createDefaultOutputProfile(generateId());
  return file;
};
