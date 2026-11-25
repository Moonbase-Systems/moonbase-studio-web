import { describe, expect, it } from 'vitest';

import {
  createDefaultOutputProfile,
  formatAspectRatio,
  matchingOutputPreset,
  OUTPUT_PRESETS,
  outputFrame,
  outputPresetById,
} from './output-profile.domain';
import { createEmptyProject } from './project.domain';

describe('output profile', () => {
  it('defines the four built-in presets once', () => {
    expect(OUTPUT_PRESETS.map((preset) => preset.id)).toEqual([
      'youtube-1080p',
      'shorts-1080',
      'square-1080',
      'portrait-4x5',
    ]);
    expect(new Set(OUTPUT_PRESETS.map((preset) => preset.id)).size).toBe(OUTPUT_PRESETS.length);
    expect(outputPresetById('shorts-1080')).toEqual({
      id: 'shorts-1080',
      name: 'Vertical 1080p',
      width: 1080,
      height: 1920,
      frameRate: 30,
    });
  });

  it('gives every new project its own YouTube 1080p profile', () => {
    const first = createEmptyProject({ id: 'p1', name: 'One', type: 'general' });
    const second = createEmptyProject({ id: 'p2', name: 'Two', type: 'general' });

    expect(first.settings.outputProfile).toMatchObject({
      name: 'YouTube 1080p',
      width: 1920,
      height: 1080,
      frameRate: 30,
      originPresetId: 'youtube-1080p',
    });
    expect(first.settings.outputProfile.id).not.toBe(second.settings.outputProfile.id);
    expect(first.settings.outputProfile).not.toBe(second.settings.outputProfile);

    first.settings.outputProfile.width = 10;
    expect(second.settings.outputProfile.width).toBe(1920);
  });

  it('matches a preset only when width, height and frame rate are exact', () => {
    expect(matchingOutputPreset({ width: 1920, height: 1080, frameRate: 30 })?.id).toBe('youtube-1080p');
    expect(matchingOutputPreset({ width: 1080, height: 1350, frameRate: 30 })?.id).toBe('portrait-4x5');
    expect(matchingOutputPreset({ width: 1920, height: 1080, frameRate: 29.97 })).toBeNull();
    expect(matchingOutputPreset({ width: 2560, height: 1440, frameRate: 30 })).toBeNull();
    expect(formatAspectRatio(1080, 1350)).toBe('4:5');
    expect(formatAspectRatio(1920, 1080)).toBe('16:9');
  });

  it('reads the frame from the active profile', () => {
    const project = createEmptyProject({ id: 'p1', name: 'One', type: 'general' });
    project.settings.outputProfile = {
      ...createDefaultOutputProfile('profile-1'),
      width: 1080,
      height: 1920,
      frameRate: 59.94,
    };
    expect(outputFrame(project)).toEqual({ width: 1080, height: 1920, frameRate: 59.94 });
    expect(outputFrame(null)).toEqual({ width: 1920, height: 1080, frameRate: 30 });
  });
});
