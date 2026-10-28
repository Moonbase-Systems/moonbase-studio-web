import { describe, expect, it } from 'vitest';

import { createProjectFileWithSources } from '../test-utils/project-fixtures';
import { parseProjectFile } from './project-file';
import { migrateProjectFileV1ToV2 } from './project-file-migrate-v1-v2';

describe('migrateProjectFileV1ToV2', () => {
  it('moves crop effect to element crop and adds settings', () => {
    const v1 = createProjectFileWithSources() as unknown as Record<string, unknown>;
    v1.formatVersion = 1;
    const element = (v1.project as { scenes: { elements: Record<string, unknown>[] }[] }).scenes[0]!.elements[0]!;
    element.transform = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    };
    delete element.crop;
    delete element.settings;
    element.effects = [
      {
        id: 'fx-crop',
        type: 'crop',
        enabled: true,
        parameters: { top: 0.1, right: 0.2, bottom: 0.3, left: 0.4 },
      },
    ];

    const migrated = migrateProjectFileV1ToV2(v1) as {
      formatVersion: number;
      project: { scenes: { elements: { crop: unknown; effects: unknown[]; settings?: unknown }[] }[] };
    };
    expect(migrated.formatVersion).toBe(2);
    const migratedElement = migrated.project.scenes[0]!.elements[0]!;
    expect(migratedElement.crop).toEqual({ top: 0.1, right: 0.2, bottom: 0.3, left: 0.4 });
    expect(migratedElement.effects).toEqual([]);
    expect(migratedElement.settings).toBeDefined();

    const parsed = parseProjectFile(migrated);
    expect(parsed.ok).toBe(true);
  });
});
