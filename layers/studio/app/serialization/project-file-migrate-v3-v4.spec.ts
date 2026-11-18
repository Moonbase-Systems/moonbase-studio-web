import { describe, expect, it } from 'vitest';

import { createProjectFileWithSources, createValidProjectFile } from '../test-utils/project-fixtures';
import { migrateProjectFile, parseProjectFile, serializeProjectFile } from './project-file';

const asV3 = (mutate?: (video: Record<string, unknown>) => void) => {
  const current = structuredClone(createProjectFileWithSources());
  const profile = current.project.settings.outputProfile;
  const transform = structuredClone(current.project.scenes[0]!.elements[0]!.transform);
  const raw = current as unknown as {
    formatVersion: number;
    project: {
      settings: { video: Record<string, unknown>; outputProfile?: unknown };
      scenes: { elements: { transform: unknown }[] }[];
    };
  };
  raw.formatVersion = 3;
  raw.project.settings.video = {
    width: profile.width,
    height: profile.height,
    frameRate: profile.frameRate,
    colorSpace: 'bt709',
  };
  delete raw.project.settings.outputProfile;
  mutate?.(raw.project.settings.video);
  return { raw, transform };
};

describe('migrateProjectFile v3 to v4', () => {
  it('copies the frame exactly and keeps the new id on the next read', () => {
    let generated = 0;
    const generateId = () => {
      generated += 1;
      return `profile-${generated}`;
    };
    const { raw, transform } = asV3((video) => {
      video.frameRate = 29.97;
    });

    const migrated = migrateProjectFile(raw, generateId);
    const first = parseProjectFile(migrated.file);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const profile = first.project.settings.outputProfile;
    expect(profile).toMatchObject({
      id: 'profile-1',
      width: 1920,
      height: 1080,
      frameRate: 29.97,
      originPresetId: null,
    });
    expect(first.project.settings.video).toEqual({ colorSpace: 'bt709' });
    expect(first.project.scenes[0]!.elements[0]!.transform).toEqual(transform);
    expect(generated).toBe(1);

    const again = migrateProjectFile(first.file, generateId);
    const second = parseProjectFile(serializeProjectFile(first.project));
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }
    expect(generated).toBe(1);
    expect(again.file).toMatchObject({ formatVersion: 4 });
    expect(second.project.settings.outputProfile.id).toBe(profile.id);
    expect(second.project.settings.outputProfile.frameRate).toBe(29.97);
    expect(second.project.scenes[0]!.elements[0]!.transform).toEqual(transform);
  });

  it('records the preset id only when the old frame matches exactly', () => {
    const { raw } = asV3();
    const parsed = parseProjectFile(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.project.settings.outputProfile.originPresetId).toBe('youtube-1080p');
    expect(parsed.project.settings.outputProfile.name).toBe('YouTube 1080p');
    expect(parsed.file.formatVersion).toBe(4);
  });

  it('does not replace a valid custom frame with the default profile', () => {
    const { raw } = asV3((video) => {
      video.width = 1280;
      video.height = 720;
      video.frameRate = 59.94;
    });
    const parsed = parseProjectFile(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.project.settings.outputProfile).toMatchObject({
      width: 1280,
      height: 720,
      frameRate: 59.94,
      originPresetId: null,
      name: '1280×720 @ 59.94',
    });
  });

  it('falls back to the default profile when the old frame is missing', () => {
    const current = structuredClone(createValidProjectFile());
    const raw = current as unknown as {
      formatVersion: number;
      project: { settings: { video: Record<string, unknown>; outputProfile?: unknown } };
    };
    raw.formatVersion = 3;
    raw.project.settings.video = { colorSpace: 'bt709' };
    delete raw.project.settings.outputProfile;

    const parsed = parseProjectFile(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.project.settings.outputProfile).toMatchObject({
      width: 1920,
      height: 1080,
      frameRate: 30,
      originPresetId: 'youtube-1080p',
    });
    expect(parsed.project.settings.video.colorSpace).toBe('bt709');
    expect(parsed.project.scenes).toEqual(current.project.scenes);
  });
});
