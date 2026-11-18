import { describe, expect, it } from 'vitest';

import { createValidProjectFile } from '../test-utils/project-fixtures';
import { projectFileSchema } from './project-file.schema';

describe('overlay bus schema', () => {
  it('fills a missing overlay bus without sharing that object between files', () => {
    const file = createValidProjectFile();
    const mixer = file.project.audioMixer as { overlay?: unknown };
    delete mixer.overlay;
    const first = projectFileSchema.safeParse(file);
    const second = projectFileSchema.safeParse(structuredClone(file));
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) {
      return;
    }
    first.data.project.audioMixer.overlay.sounds.push({
      id: 'sound-1',
      name: 'Sting',
      assetId: 'asset-1',
      volumeDb: 0,
      muted: false,
      enabled: true,
      loop: false,
      startTimeSec: 0,
      playbackRate: 1,
      maxInstances: 4,
      cooldownMs: 0,
      restartPolicy: 'allow',
    });
    expect(second.data.project.audioMixer.overlay.sounds).toEqual([]);
    expect(second.data.project.audioMixer.overlay.maxInstances).toBe(16);
    expect(second.data.project.audioMixer.overlay.sceneChangePolicy).toBe('continue');
  });

  it('rejects an overlay sound whose asset is missing or not audio, and a trigger for an unknown sound', () => {
    const file = createValidProjectFile();
    file.project.assets.push({
      id: 'picture',
      name: 'Picture',
      type: 'image',
      location: { kind: 'remoteUrl', url: 'https://example.com/picture.png' },
      availability: 'available',
    });
    file.project.audioMixer.overlay.sounds = [
      {
        id: 'sound-1',
        name: 'Sting',
        assetId: 'picture',
        volumeDb: 0,
        muted: false,
        enabled: true,
        loop: false,
        startTimeSec: 0,
        playbackRate: 1,
        maxInstances: 4,
        cooldownMs: 0,
        restartPolicy: 'allow',
      },
    ];
    const picture = projectFileSchema.safeParse(file);
    expect(picture.success).toBe(false);

    file.project.assets[0] = {
      ...file.project.assets[0]!,
      id: 'sting',
      name: 'Sting',
      type: 'audio',
      location: { kind: 'remoteUrl', url: 'https://example.com/sting.mp3' },
    };
    file.project.audioMixer.overlay.sounds[0]!.assetId = 'sting';
    file.project.audioMixer.overlay.sounds[0]!.endTimeSec = 0;
    const backwards = projectFileSchema.safeParse(file);
    expect(backwards.success).toBe(false);

    delete file.project.audioMixer.overlay.sounds[0]!.endTimeSec;
    file.project.audioMixer.overlay.triggers = [{ id: 'trigger-1', soundId: 'missing', event: 'shown', enabled: true }];
    const trigger = projectFileSchema.safeParse(file);
    expect(trigger.success).toBe(false);

    file.project.audioMixer.overlay.triggers = [{ id: 'trigger-1', soundId: 'sound-1', event: 'shown', enabled: true }];
    expect(projectFileSchema.safeParse(file).success).toBe(true);
  });
});
