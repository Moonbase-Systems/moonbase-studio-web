import { describe, expect, it } from 'vitest';

import type { Project } from '../../models/project.domain';
import { createEmptyScene, type Scene } from '../../models/scene.domain';
import { createSourceBackedElement, type SceneElement } from '../../models/scene-element.domain';
import type { Source } from '../../models/source.domain';
import { previewFullyCovered, projectPointCovered, signalCovers } from './preview-signal-covers';

const video = { width: 1920, height: 1080, frameRate: 30 };
const composition = { width: video.width, height: video.height };

const imageSource: Source = { id: 'src-image', name: 'Image', type: 'image', assetId: 'asset-1' };
const textSource: Source = { id: 'src-text', name: 'Text', type: 'text', content: 'Hello' };
const shapeSource: Source = { id: 'src-shape', name: 'Shape', type: 'shape', shapeKind: 'ellipse' };
const audioSource: Source = { id: 'src-audio', name: 'Mic', type: 'audio' };

const sceneWith = (elements: SceneElement[], background: Scene['background'] = { kind: 'none' }): Scene => ({
  ...createEmptyScene({ id: 'scene-1', name: 'Scene' }),
  background,
  elements,
});

describe('signalCovers', () => {
  it('treats a full-frame layer as covering the preview and a point inside it', () => {
    const layer = createSourceBackedElement({ id: 'layer', source: imageSource, video });
    const covers = signalCovers(sceneWith([layer]));

    expect(previewFullyCovered(covers, composition, composition)).toBe(true);
    expect(projectPointCovered(covers, composition, { x: 400, y: 300 })).toBe(true);
  });

  it('leaves points outside a small layer, and does not idle the whole frame', () => {
    const layer = createSourceBackedElement({
      id: 'layer',
      source: imageSource,
      video,
      transform: { x: 100, y: 80, width: 200, height: 120 },
    });
    const covers = signalCovers(sceneWith([layer]));

    expect(previewFullyCovered(covers, composition, composition)).toBe(false);
    expect(projectPointCovered(covers, composition, { x: 150, y: 120 })).toBe(true);
    expect(projectPointCovered(covers, composition, { x: 20, y: 20 })).toBe(false);
  });

  it('ignores a translucent layer and text without a solid background', () => {
    const faint = createSourceBackedElement({
      id: 'faint',
      source: imageSource,
      video,
      appearance: { opacity: 0.4 },
    });
    const text = createSourceBackedElement({ id: 'title', source: textSource, video });
    const covers = signalCovers(sceneWith([faint, text]));

    expect(covers).toEqual([]);
    expect(projectPointCovered(covers, composition, { x: 960, y: 540 })).toBe(false);
  });

  it('does not let an audio layer cover the frame', () => {
    const audio = createSourceBackedElement({ id: 'mic', source: audioSource, video });
    const covers = signalCovers(sceneWith([audio]));

    expect(covers).toEqual([]);
    expect(previewFullyCovered(covers, composition, composition)).toBe(false);
    expect(projectPointCovered(covers, composition, { x: 960, y: 540 })).toBe(false);
  });

  it('covers only the fitted picture, not the empty bars of a contained image', () => {
    const image = createSourceBackedElement({
      id: 'photo',
      source: imageSource,
      video,
      transform: { x: 0, y: 0, width: 200, height: 100 },
    });
    const project = {
      sources: [imageSource],
      assets: [
        {
          id: 'asset-1',
          name: 'Photo',
          type: 'image',
          location: { kind: 'storageKey', key: 'photo' },
          availability: 'available',
          metadata: { width: 100, height: 100 },
        },
      ],
    } as Project;
    const covers = signalCovers(sceneWith([image]), project);

    expect(projectPointCovered(covers, composition, { x: 100, y: 50 })).toBe(true);
    expect(projectPointCovered(covers, composition, { x: 10, y: 50 })).toBe(false);
  });

  it('covers the centre of an ellipse and not the corner of its box', () => {
    const ellipse = createSourceBackedElement({
      id: 'blob',
      source: shapeSource,
      video,
      transform: { x: 0, y: 0, width: 200, height: 100 },
    });
    const covers = signalCovers(sceneWith([ellipse]));

    expect(projectPointCovered(covers, composition, { x: 100, y: 50 })).toBe(true);
    expect(projectPointCovered(covers, composition, { x: 1, y: 1 })).toBe(false);
  });

  it('covers the whole frame when the scene background is a colour', () => {
    const covers = signalCovers(sceneWith([], { kind: 'color', color: '#000000' }));

    expect(previewFullyCovered(covers, composition, { width: 960, height: 540 })).toBe(true);
    expect(projectPointCovered(covers, composition, { x: 10, y: 10 })).toBe(true);
  });
});
