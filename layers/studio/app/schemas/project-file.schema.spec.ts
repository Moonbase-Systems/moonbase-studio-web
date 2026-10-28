import { describe, expect, it } from 'vitest';

import { createProjectFileWithSources, createValidProjectFile } from '../test-utils/project-fixtures';
import { projectFileSchema } from './project-file.schema';

describe('projectFileSchema', () => {
  it('accepts a valid empty project file', () => {
    const result = projectFileSchema.safeParse(createValidProjectFile());
    expect(result.success).toBe(true);
  });

  it('rejects an invalid project file missing required fields', () => {
    const result = projectFileSchema.safeParse({
      formatVersion: 2,
      project: { id: 'x' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown sourceId on scene elements', () => {
    const file = createProjectFileWithSources();
    const element = file.project.scenes[0]!.elements[0]!;
    expect(element.type).not.toBe('overlay');
    if (element.type === 'overlay') {
      throw new Error('expected source-backed element');
    }
    element.sourceId = 'missing-source';

    const result = projectFileSchema.safeParse(file);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('unknownSource'))).toBe(true);
    }
  });

  it('rejects unknown assetId on image sources', () => {
    const file = createProjectFileWithSources();
    const imageSource = file.project.sources.find((s) => s.type === 'image');
    expect(imageSource).toBeDefined();
    if (imageSource?.type === 'image') {
      imageSource.assetId = 'missing-asset';
    }

    const result = projectFileSchema.safeParse(file);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('unknownAsset'))).toBe(true);
    }
  });

  it('rejects unknown defaultTransitionId', () => {
    const file = createValidProjectFile();
    file.project.scenes[0]!.settings.defaultTransitionId = 'missing-transition';

    const result = projectFileSchema.safeParse(file);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('unknownTransition'))).toBe(true);
    }
  });

  it('validates typed source configs', () => {
    const file = createValidProjectFile();
    file.project.sources = [
      {
        id: 'camera-1',
        name: 'Webcam',
        type: 'camera',
        deviceId: 'dev-1',
      },
      {
        id: 'screen-1',
        name: 'Display',
        type: 'screen',
        displayId: 'display-1',
      },
      {
        id: 'browser-1',
        name: 'Browser',
        type: 'browser',
        url: 'https://example.com',
        width: 1280,
        height: 720,
        refreshSettings: {
          intervalMs: null,
          refreshOnActivate: true,
          bypassCache: false,
        },
      },
      {
        id: 'audio-1',
        name: 'Mic',
        type: 'audio',
        deviceId: 'mic-1',
      },
    ];

    const result = projectFileSchema.safeParse(file);
    expect(result.success).toBe(true);
  });

  it('rejects invalid browser source url', () => {
    const file = createValidProjectFile();
    file.project.sources = [
      {
        id: 'browser-1',
        name: 'Browser',
        type: 'browser',
        url: 'not-a-url',
        width: 1280,
        height: 720,
        refreshSettings: {
          intervalMs: null,
          refreshOnActivate: false,
          bypassCache: false,
        },
      },
    ];

    const result = projectFileSchema.safeParse(file);
    expect(result.success).toBe(false);
  });

  it('accepts typed element effects and crop on element', () => {
    const file = createProjectFileWithSources();
    const element = file.project.scenes[0]!.elements[0]!;
    element.crop = { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 };
    element.effects = [
      {
        id: 'fx-chroma',
        name: 'Chroma key',
        type: 'chroma-key',
        enabled: true,
        parameters: { keyColor: '#00ff00', similarity: 0.4, smoothness: 0.1, spill: 0.05 },
      },
      {
        id: 'fx-color',
        name: 'Color',
        type: 'color-correction',
        enabled: false,
        parameters: { brightness: 0.1, contrast: 0, saturation: 0.2, hue: 15, gamma: 1, temperature: 0 },
      },
      {
        id: 'fx-blur',
        name: 'Blur',
        type: 'blur',
        enabled: true,
        parameters: { radius: 4 },
      },
    ];

    const result = projectFileSchema.safeParse(file);
    expect(result.success).toBe(true);
  });

  it('rejects unsupported effect types and invalid crop', () => {
    const file = createProjectFileWithSources();
    file.project.scenes[0]!.elements[0]!.effects = [
      {
        id: 'fx-bad',
        name: 'Bad',
        type: 'glow',
        enabled: true,
        parameters: {},
      } as never,
    ];

    const unsupported = projectFileSchema.safeParse(file);
    expect(unsupported.success).toBe(false);

    file.project.scenes[0]!.elements[0]!.effects = [];
    file.project.scenes[0]!.elements[0]!.crop = { top: 2, right: 0, bottom: 0, left: 0 };

    const invalidParams = projectFileSchema.safeParse(file);
    expect(invalidParams.success).toBe(false);
  });

  it('accepts dissolve transition and rejects unknown transition type', () => {
    const file = createValidProjectFile();
    file.project.transitions = [
      {
        id: 'tr-1',
        type: 'dissolve',
        durationMs: 500,
        easing: 'linear',
        settings: { softEdge: 0.2 },
      },
    ];

    expect(projectFileSchema.safeParse(file).success).toBe(true);

    file.project.transitions = [
      {
        id: 'tr-2',
        type: 'wipe',
        durationMs: 500,
        easing: 'linear',
        settings: {},
      } as never,
    ];

    expect(projectFileSchema.safeParse(file).success).toBe(false);
  });
});
