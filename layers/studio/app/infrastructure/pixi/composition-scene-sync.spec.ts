import { describe, expect, it } from 'vitest';

import type { ProjectVideoSettings } from '../../models/project.domain';
import { createEmptyScene, type Scene } from '../../models/scene.domain';
import { createSourceBackedElement, type SceneElement } from '../../models/scene-element.domain';
import { createSceneGroup } from '../../models/scene-group.domain';
import type { Source } from '../../models/source.domain';
import {
  alignTextBlock,
  cropFrame,
  fitContentRect,
  letterboxComposition,
  linearGradientPoints,
  placementForTransform,
  toFontWeight,
} from './composition-geometry';
import { elementContentKey, planSceneSync, type RenderedSceneIds } from './composition-scene-sync';

const video: ProjectVideoSettings = { width: 1920, height: 1080, frameRate: 30 };
const nothingRendered: RenderedSceneIds = { elementIds: new Set(), groupIds: new Set() };

const shapeSource: Source = { id: 'src-shape', name: 'Shape', type: 'shape', shapeKind: 'rect' };
const textSource: Source = { id: 'src-text', name: 'Text', type: 'text', content: 'Hello' };
const audioSource: Source = { id: 'src-audio', name: 'Mic', type: 'audio' };

const element = (id: string, source: Source): SceneElement =>
  createSourceBackedElement({ id, source, video, transform: { width: 200, height: 100 } });

const sceneWith = (elements: SceneElement[], groups: Scene['groups'] = []): Scene => ({
  ...createEmptyScene({ id: 'scene-1', name: 'Scene 1' }),
  elements,
  groups,
});

const rootIds = (scene: Scene): string[] =>
  planSceneSync(scene, nothingRendered).roots.map((root) =>
    root.kind === 'element' ? root.element.id : `${root.group.id}[${root.members.map((m) => m.id).join(',')}]`,
  );

describe('planSceneSync', () => {
  it('keeps scene.elements order bottom to top and skips audio layers', () => {
    const scene = sceneWith([element('a', shapeSource), element('mic', audioSource), element('b', textSource)]);
    expect(rootIds(scene)).toEqual(['a', 'b']);
  });

  it('places a group at its lowest member index with members in group order', () => {
    const grouped = [element('g1', shapeSource), element('g2', textSource)].map((item) => ({
      ...item,
      parentGroupId: 'group-1',
    }));
    const group = createSceneGroup({ id: 'group-1', name: 'Group', elementIds: ['g1', 'g2'], video });
    const scene = sceneWith([element('bottom', shapeSource), ...grouped, element('top', textSource)], [group]);

    expect(rootIds(scene)).toEqual(['bottom', 'group-1[g1,g2]', 'top']);
  });

  it('lists ids that were rendered before and are gone now', () => {
    const scene = sceneWith([element('kept', shapeSource)]);
    const plan = planSceneSync(scene, {
      elementIds: new Set(['kept', 'removed']),
      groupIds: new Set(['old-group']),
    });

    expect(plan.removedElementIds).toEqual(['removed']);
    expect(plan.removedGroupIds).toEqual(['old-group']);
  });

  it('reports broken group references instead of dropping them silently', () => {
    const orphan = { ...element('orphan', shapeSource), parentGroupId: 'missing-group' };
    const group = createSceneGroup({ id: 'group-1', name: 'Group', elementIds: ['ghost'], video });
    const plan = planSceneSync(sceneWith([orphan], [group]), nothingRendered);

    expect(plan.issues.map((issue) => issue.elementId)).toEqual(['ghost', 'orphan']);
  });
});

describe('elementContentKey', () => {
  it('ignores position, rotation, opacity and visibility', () => {
    const base = element('a', textSource);
    const moved: SceneElement = {
      ...base,
      transform: { ...base.transform, x: 400, y: 300, rotation: 45, scaleX: 2 },
      appearance: { opacity: 0.3 },
      visibility: false,
    };
    expect(elementContentKey(moved)).toBe(elementContentKey(base));
  });

  it('changes with text content, box size and image url', () => {
    const base = element('a', textSource);
    if (base.type !== 'text') {
      throw new Error('expected text element');
    }
    const edited: SceneElement = { ...base, settings: { ...base.settings, text: 'Changed' } };
    const resized: SceneElement = { ...base, transform: { ...base.transform, width: 640 } };

    expect(elementContentKey(edited)).not.toBe(elementContentKey(base));
    expect(elementContentKey(resized)).not.toBe(elementContentKey(base));

    const image = element('img', { id: 'src-img', name: 'Img', type: 'image', assetId: 'asset-1' });
    expect(elementContentKey(image, 'blob:one')).not.toBe(elementContentKey(image, 'blob:two'));
  });

  it('keeps image keys across resizes and crops so loaded media is re-fitted in place', () => {
    const image = element('img', { id: 'src-img', name: 'Img', type: 'image', assetId: 'asset-1' });
    const resized: SceneElement = { ...image, transform: { ...image.transform, width: 640 } };
    const cropped: SceneElement = { ...image, crop: { ...image.crop, left: 0.25 } };
    expect(elementContentKey(resized, 'blob:one')).toBe(elementContentKey(image, 'blob:one'));
    expect(elementContentKey(cropped, 'blob:one')).toBe(elementContentKey(image, 'blob:one'));
  });

  it('ignores screen showCursor so toggling the cursor does not rebuild the capture', () => {
    const screen = element('scr', { id: 'src-screen', name: 'Screen', type: 'screen' });
    if (screen.type !== 'screen') {
      throw new Error('expected screen element');
    }
    const toggled: SceneElement = {
      ...screen,
      settings: { ...screen.settings, showCursor: !screen.settings.showCursor },
    };
    expect(elementContentKey(toggled, 'stream-1')).toBe(elementContentKey(screen, 'stream-1'));
  });
});

describe('composition geometry', () => {
  it('letterboxes the project frame into the canvas', () => {
    expect(letterboxComposition({ width: 1920, height: 1080 }, { width: 960, height: 1080 })).toEqual({
      scale: 0.5,
      offsetX: 0,
      offsetY: 270,
    });
  });

  it('uses the anchor as pivot and converts degrees to radians', () => {
    const placement = placementForTransform({
      ...element('a', shapeSource).transform,
      x: 10,
      y: 20,
      anchorX: 0.5,
      anchorY: 0.5,
      rotation: 90,
    });
    expect(placement).toMatchObject({ x: 110, y: 70, pivotX: 100, pivotY: 50 });
    expect(placement.rotation).toBeCloseTo(Math.PI / 2);
  });

  it('fits content with contain, cover and fill', () => {
    const box = { width: 200, height: 100 };
    const content = { width: 100, height: 100 };
    expect(fitContentRect('contain', box, content)).toEqual({ x: 50, y: 0, width: 100, height: 100 });
    expect(fitContentRect('cover', box, content)).toEqual({ x: 0, y: -50, width: 200, height: 200 });
    expect(fitContentRect('fill', box, content)).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });

  it('crops by source fractions', () => {
    expect(cropFrame({ left: 0.25, right: 0.25, top: 0, bottom: 0.5 }, { width: 400, height: 200 })).toEqual({
      x: 100,
      y: 0,
      width: 200,
      height: 100,
    });
  });

  it('aligns a text block inside its box', () => {
    expect(alignTextBlock('right', 'bottom', { width: 300, height: 100 }, { width: 100, height: 40 }, 8)).toEqual({
      x: 192,
      y: 52,
    });
  });

  it('maps gradient angle and font weight', () => {
    expect(linearGradientPoints(0)).toEqual({ start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } });
    expect(toFontWeight(400)).toBe('400');
    expect(toFontWeight('650')).toBe('700');
    expect(toFontWeight('bold')).toBe('bold');
    expect(toFontWeight('heavy')).toBe('normal');
  });
});
