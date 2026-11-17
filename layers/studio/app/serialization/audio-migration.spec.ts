import { describe, expect, it } from 'vitest';

import { createValidProjectFile } from '../test-utils/project-fixtures';
import { migrateProjectFileV2ToV3 } from './audio-migration';
import { parseProjectFile } from './project-file';

const audioLayer = (input: {
  id: string;
  sourceId: string;
  name: string;
  volume: number;
  monitoring: 'off' | 'monitor' | 'monitor-and-output';
}) => ({
  id: input.id,
  name: input.name,
  parentGroupId: null,
  transform: {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    anchorX: 0.5,
    anchorY: 0.5,
    flipX: false,
    flipY: false,
    keepAspectRatio: false,
  },
  crop: { top: 0, right: 0, bottom: 0, left: 0 },
  appearance: { opacity: 1 },
  effects: [],
  visibility: true,
  locked: false,
  type: 'audioVisual',
  sourceId: input.sourceId,
  settings: {
    volume: input.volume,
    muted: false,
    solo: false,
    gainDb: 0,
    pan: 0,
    syncOffsetMs: 0,
    monitoring: input.monitoring,
  },
});

const v2File = () => {
  const file = structuredClone(createValidProjectFile()) as unknown as {
    formatVersion: number;
    project: {
      sources: unknown[];
      scenes: Array<Record<string, unknown> & { id: string; name: string; elements: unknown[] }>;
      audioMixer: { channels: unknown[] };
    };
  };
  file.formatVersion = 2;
  return file;
};

describe('migrateProjectFileV2ToV3', () => {
  it('keeps one strip when every scene agrees and reuses that channel', () => {
    const file = v2File();
    file.project.sources = [{ id: 'mic', name: 'Mic', type: 'audio', deviceId: 'mic-1' }];
    const layer = audioLayer({
      id: 'layer-a',
      sourceId: 'mic',
      name: 'Mic',
      volume: 0.5,
      monitoring: 'monitor-and-output',
    });
    file.project.scenes[0]!.elements = [layer];
    file.project.scenes.push({
      ...file.project.scenes[0]!,
      id: 'scene-b',
      name: 'Scene B',
      elements: [{ ...layer, id: 'layer-b' }],
    });

    const migrated = migrateProjectFileV2ToV3(file);
    expect(migrated.conflicts).toEqual([]);
    const parsed = parseProjectFile(migrated.file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    const channel = parsed.project.audioMixer.channels[0]!;
    expect(channel.sourceIds).toEqual(['mic']);
    expect(channel.faderDb).toBeCloseTo(-6.02, 1);
    expect(channel.monitoring).toBe('monitor-and-output');
    const layers = parsed.project.scenes.flatMap((scene) => scene.elements);
    expect(layers.every((element) => element.type === 'audioVisual' && element.channelId === channel.id)).toBe(true);
  });

  it('resets a conflicting strip to neutral and reports every vote, including monitoring off', () => {
    const file = v2File();
    file.project.sources = [{ id: 'mic', name: 'Mic', type: 'audio', deviceId: 'mic-1' }];
    const base = file.project.scenes[0]!;
    file.project.scenes = [
      {
        ...base,
        id: 'scene-a',
        name: 'Talk',
        elements: [audioLayer({ id: 'layer-a', sourceId: 'mic', name: 'Mic', volume: 1, monitoring: 'monitor' })],
      },
      {
        ...base,
        id: 'scene-b',
        name: 'Game',
        elements: [audioLayer({ id: 'layer-b', sourceId: 'mic', name: 'Mic', volume: 0.5, monitoring: 'off' })],
      },
    ];

    const migrated = migrateProjectFileV2ToV3(file);
    expect(migrated.conflicts).toHaveLength(1);
    const conflict = migrated.conflicts[0]!;
    expect(conflict.strip.monitoring).toBe('off');
    expect(conflict.strip.faderDb).toBe(0);
    expect(conflict.votes.map((vote) => vote.origin.kind === 'scene' && vote.origin.sceneName)).toEqual([
      'Talk',
      'Game',
    ]);

    const parsed = parseProjectFile(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.conflicts).toHaveLength(1);
    expect(parsed.project.audioMixer.channels[0]?.monitoring).toBe('off');
    expect(parsed.file.formatVersion).toBe(3);
  });

  it('ignores a factory mixer channel when scene layers already describe the strip', () => {
    const file = v2File();
    file.project.sources = [{ id: 'mic', name: 'Mic', type: 'audio', deviceId: 'mic-1' }];
    file.project.scenes[0]!.elements = [
      audioLayer({ id: 'layer-a', sourceId: 'mic', name: 'Host', volume: 0.5, monitoring: 'monitor' }),
    ];
    file.project.audioMixer.channels = [
      {
        id: 'old-channel',
        name: 'Host',
        sourceId: 'mic',
        volume: 1,
        muted: false,
        solo: false,
        pan: 0,
        filters: [],
        effects: [],
      },
    ];

    const migrated = migrateProjectFileV2ToV3(file);
    expect(migrated.conflicts).toEqual([]);
    const parsed = parseProjectFile(migrated.file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.project.audioMixer.channels).toHaveLength(1);
    expect(parsed.project.audioMixer.channels[0]?.id).toBe('old-channel');
    expect(parsed.project.audioMixer.channels[0]?.monitoring).toBe('monitor');
  });
});
