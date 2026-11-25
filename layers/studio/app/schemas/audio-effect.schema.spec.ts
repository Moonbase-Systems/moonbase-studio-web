import { describe, expect, it } from 'vitest';

import { createAudioEffect } from '../models/audio-effect.domain';
import { createValidProjectFile } from '../test-utils/project-fixtures';
import { audioUserPresetSchema } from './audio-effect.schema';
import { projectFileSchema } from './project-file.schema';

describe('audio effect schema', () => {
  it('fills master effects and user presets when an older file omits them', () => {
    const file = createValidProjectFile();
    const master = file.project.audioMixer.master as { effects?: unknown };
    const mixer = file.project.audioMixer as { presets?: unknown };
    delete master.effects;
    delete mixer.presets;
    const parsed = projectFileSchema.safeParse(file);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.project.audioMixer.master.effects).toEqual([]);
    expect(parsed.data.project.audioMixer.presets).toEqual([]);
  });

  it('accepts a typed effect and rejects the wrong preset version', () => {
    const effect = createAudioEffect({ id: 'eq', type: 'eq-band' });
    const file = createValidProjectFile();
    file.project.audioMixer.channels = [
      {
        id: 'ch',
        name: 'Host',
        sourceIds: [],
        trimDb: 0,
        faderDb: 0,
        pan: 0,
        muted: false,
        solo: false,
        monitoring: 'off',
        syncOffsetMs: 0,
        global: false,
        filters: [{ id: 'legacy', type: 'unknown', enabled: false, parameters: { leftover: true } }],
        effects: [effect],
      },
    ];
    expect(projectFileSchema.safeParse(file).success).toBe(true);
    expect(
      audioUserPresetSchema.safeParse({
        id: 'p',
        formatVersion: 2,
        kind: 'effect',
        name: 'Air',
        effect: { type: effect.type, name: effect.name, enabled: true, parameters: effect.parameters },
      }).success,
    ).toBe(false);
  });
});
