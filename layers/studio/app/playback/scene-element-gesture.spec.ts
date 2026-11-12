import { describe, expect, it } from 'vitest';

import type { Transform2D } from '../models/common.domain';
import { createEmptyScene, type Scene } from '../models/scene.domain';
import { createSourceBackedElement, type SceneElement } from '../models/scene-element.domain';
import type { Source } from '../models/source.domain';
import {
  applyAffine,
  boxCorners,
  canCrop,
  centreAnchor,
  cropElement,
  drawsAbove,
  fitBoxToPicture,
  type Handle,
  handleCursor,
  HANDLES,
  hitTestScene,
  hitTestSceneExcluding,
  IDENTITY,
  keepsAspectRatio,
  moveElement,
  pickCorner,
  pickHandle,
  pickSide,
  resizeElement,
  rotateElement,
  transformAffine,
} from './scene-element-gesture';

const frame = { width: 1920, height: 1080 };
const snap = { frame, threshold: 10 };
const video = { ...frame, frameRate: 30 };
const shapeSource: Source = { id: 'src-shape', name: 'Shape', type: 'shape', shapeKind: 'rect' };

const box = (overrides: Partial<Transform2D> = {}): Transform2D => ({
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  anchorX: 0.5,
  anchorY: 0.5,
  flipX: false,
  flipY: false,
  keepAspectRatio: false,
  ...overrides,
});

const handle = (id: Handle['id']): Handle => HANDLES.find((item) => item.id === id)!;

const corners = (t: Transform2D) =>
  boxCorners(transformAffine(t), t).map((point) => ({ x: Math.round(point.x), y: Math.round(point.y) }));

const element = (id: string, transform: Partial<Transform2D>): SceneElement =>
  createSourceBackedElement({ id, source: shapeSource, video, transform: box(transform) });

const sceneWith = (elements: SceneElement[]): Scene => ({
  ...createEmptyScene({ id: 'scene-1', name: 'Scene 1' }),
  elements,
});

describe('centreAnchor', () => {
  it('moves the pivot to the middle without moving the rotated picture', () => {
    const corner = box({ anchorX: 0, anchorY: 0, rotation: 30, scaleX: 2 });
    const centred = centreAnchor(corner);

    expect(centred).toMatchObject({ anchorX: 0.5, anchorY: 0.5 });
    const before = boxCorners(transformAffine(corner), corner);
    const after = boxCorners(transformAffine(centred), centred);
    after.forEach((point, index) => {
      expect(point.x).toBeCloseTo(before[index]!.x);
      expect(point.y).toBeCloseTo(before[index]!.y);
    });
  });
});

describe('moveElement', () => {
  it('moves by the pointer delta', () => {
    expect(moveElement(box(), IDENTITY, { x: 40, y: -30 }, null).transform).toMatchObject({ x: 140, y: 70 });
  });

  it('pulls the nearest edge or centre onto the frame and reports the guide', () => {
    const left = moveElement(box(), IDENTITY, { x: -95, y: 0 }, snap);
    expect(left.transform.x).toBe(0);
    expect(left.guides).toEqual([{ axis: 'x', value: 0 }]);

    const centred = moveElement(box(), IDENTITY, { x: 757, y: 387 }, snap);
    expect(centred.transform).toMatchObject({ x: 860, y: 490 });
    expect(centred.guides).toEqual([
      { axis: 'x', value: 960 },
      { axis: 'y', value: 540 },
    ]);
  });

  it('stays free outside the threshold', () => {
    const free = moveElement(box(), IDENTITY, { x: -80, y: 0 }, snap);
    expect(free.transform.x).toBe(20);
    expect(free.guides).toEqual([]);
  });
});

describe('resizeElement', () => {
  it('keeps the opposite corner in place', () => {
    const start = box();
    const result = resizeElement(
      start,
      IDENTITY,
      handle('se'),
      { x: 300, y: 200 },
      { x: 350, y: 260 },
      {
        keepAspect: false,
        snap: null,
      },
    );
    const next = { ...start, ...result.transform };
    expect(next).toMatchObject({ width: 250, height: 160 });
    expect(corners(next)[0]).toEqual({ x: 100, y: 100 });
  });

  it('keeps proportions when asked, driven by the larger change', () => {
    const start = box();
    const result = resizeElement(
      start,
      IDENTITY,
      handle('se'),
      { x: 300, y: 200 },
      { x: 500, y: 210 },
      {
        keepAspect: true,
        snap: null,
      },
    );
    expect(result.transform).toMatchObject({ width: 400, height: 200 });
  });

  it('grows along the rotated axis and never collapses past the fixed edge', () => {
    const start = box({ rotation: 90 });
    const grow = resizeElement(
      start,
      IDENTITY,
      handle('e'),
      { x: 250, y: 250 },
      { x: 250, y: 300 },
      {
        keepAspect: false,
        snap: null,
      },
    );
    expect(grow.transform.width).toBe(250);

    const collapse = resizeElement(
      start,
      IDENTITY,
      handle('e'),
      { x: 250, y: 250 },
      { x: 250, y: -400 },
      {
        keepAspect: false,
        snap: null,
      },
    );
    expect(collapse.transform.width).toBe(1);
  });

  it('snaps the dragged handle to the frame edge', () => {
    const result = resizeElement(
      box(),
      IDENTITY,
      handle('e'),
      { x: 300, y: 150 },
      { x: 1915, y: 150 },
      {
        keepAspect: false,
        snap,
      },
    );
    expect(result.transform.width).toBe(1820);
    expect(result.guides).toEqual([{ axis: 'x', value: 1920 }]);
  });
});

describe('rotateElement', () => {
  it('turns around the centre and normalises the angle', () => {
    const start = box();
    const result = rotateElement(start, IDENTITY, { x: 300, y: 150 }, { x: 200, y: 50 }, null);
    expect(result.transform.rotation).toBe(270);
    const next = { ...start, ...result.transform };
    const centre = applyAffine(transformAffine(next), { x: 100, y: 50 });
    expect(centre.x).toBeCloseTo(200);
    expect(centre.y).toBeCloseTo(150);
  });

  it('snaps to steps', () => {
    const result = rotateElement(box(), IDENTITY, { x: 300, y: 150 }, { x: 300, y: 160 }, 15);
    expect(result.transform.rotation).toBe(0);
  });
});

describe('hit testing', () => {
  it('picks the topmost visible element under the point', () => {
    const bottom = element('bottom', { x: 0, y: 0, width: 400, height: 400 });
    const top = element('top', { x: 100, y: 100, width: 100, height: 100 });
    const hidden = { ...element('hidden', { x: 0, y: 0, width: 400, height: 400 }), visibility: false };
    const scene = sceneWith([bottom, top, hidden]);

    expect(hitTestScene(scene, { x: 150, y: 150 })?.id).toBe('top');
    expect(hitTestScene(scene, { x: 350, y: 350 })?.id).toBe('bottom');
    expect(hitTestScene(scene, { x: 900, y: 900 })).toBeNull();
  });

  it('can ignore the dragged element and report what sits under it', () => {
    const bottom = element('bottom', { x: 0, y: 0, width: 400, height: 400 });
    const top = element('top', { x: 100, y: 100, width: 100, height: 100 });
    const scene = sceneWith([bottom, top]);

    expect(hitTestSceneExcluding(scene, { x: 150, y: 150 }, 'top')?.id).toBe('bottom');
    expect(hitTestSceneExcluding(scene, { x: 150, y: 150 }, new Set(['top', 'bottom']))).toBeNull();
    expect(drawsAbove(scene, 'top', 'bottom')).toBe(true);
    expect(drawsAbove(scene, 'bottom', 'top')).toBe(false);
  });

  it('finds handles and rotates their cursors with the element', () => {
    const affine = transformAffine(box());
    expect(pickHandle(affine, box(), { x: 302, y: 198 }, 6)?.id).toBe('se');
    expect(handleCursor(affine, handle('e'))).toBe('ew-resize');
    expect(handleCursor(transformAffine(box({ rotation: 90 })), handle('e'))).toBe('ns-resize');
    expect(handleCursor(affine, handle('ne'))).toBe('nesw-resize');
  });

  it('finds the side under the pointer anywhere along its edge, and corners just outside the box', () => {
    const affine = transformAffine(box());
    expect(pickSide(affine, box(), { x: 140, y: 103 }, 6)?.id).toBe('n');
    expect(pickSide(affine, box(), { x: 297, y: 120 }, 6)?.id).toBe('e');
    expect(pickSide(affine, box(), { x: 200, y: 150 }, 6)).toBeNull();
    expect(pickCorner(affine, box(), { x: 92, y: 94 }, 14)?.id).toBe('nw');
    expect(pickCorner(affine, box(), { x: 200, y: 100 }, 14)).toBeNull();
  });
});

describe('element rules', () => {
  const screenSource: Source = { id: 'src-screen', name: 'Screen', type: 'screen' };

  it('always keeps the proportions of a screen capture', () => {
    const screen = createSourceBackedElement({ id: 'screen', source: screenSource, video, transform: box() });
    expect(keepsAspectRatio(screen)).toBe(true);
    expect(keepsAspectRatio(element('shape', {}))).toBe(false);
    expect(keepsAspectRatio(element('locked-ratio', { keepAspectRatio: true }))).toBe(true);
  });

  it('crops media only', () => {
    const screen = createSourceBackedElement({ id: 'screen', source: screenSource, video, transform: box() });
    expect(canCrop(screen)).toBe(true);
    expect(canCrop(element('shape', {}))).toBe(false);
  });
});

describe('cropElement', () => {
  const noCrop = { left: 0, right: 0, top: 0, bottom: 0 };

  it('trims a side while the opposite side and the picture scale stay put', () => {
    const start = box();
    const result = cropElement(start, noCrop, IDENTITY, handle('w'), { x: 100, y: 150 }, { x: 150, y: 150 }, null);
    expect(result.crop).toEqual({ left: 0.25 });
    const next = { ...start, ...result.transform };
    expect(next).toMatchObject({ width: 150, height: 100 });
    expect(corners(next)[0]).toEqual({ x: 150, y: 100 });
    expect(corners(next)[1]).toEqual({ x: 300, y: 100 });
  });

  it('gives back cropped picture when dragged outwards, but never more than the source', () => {
    const start = box({ x: 150, width: 150 });
    const crop = { ...noCrop, left: 0.25 };
    const back = cropElement(start, crop, IDENTITY, handle('w'), { x: 150, y: 150 }, { x: 125, y: 150 }, null);
    expect(back.crop.left).toBeCloseTo(0.125);
    expect(back.transform.width).toBe(175);

    const past = cropElement(start, crop, IDENTITY, handle('w'), { x: 150, y: 150 }, { x: 0, y: 150 }, null);
    expect(past.crop.left).toBe(0);
    expect(past.transform.width).toBe(200);
  });

  it('keeps at least one pixel of picture', () => {
    const result = cropElement(box(), noCrop, IDENTITY, handle('s'), { x: 200, y: 200 }, { x: 200, y: -500 }, null);
    expect(result.transform.height).toBe(1);
    expect(result.crop.bottom).toBeCloseTo(0.99);
  });

  it('crops the mirrored edge of a flipped picture', () => {
    const result = cropElement(
      box({ flipX: true }),
      noCrop,
      IDENTITY,
      handle('w'),
      { x: 100, y: 150 },
      { x: 120, y: 150 },
      null,
    );
    expect(result.crop).toEqual({ right: 0.1 });
  });

  it('snaps the cropped side to the frame', () => {
    const start = box({ x: 0, y: 0, width: 1920, height: 1080 });
    const result = cropElement(start, noCrop, IDENTITY, handle('e'), { x: 1920, y: 540 }, { x: 966, y: 540 }, snap);
    expect(result.transform.width).toBe(960);
    expect(result.crop.right).toBeCloseTo(0.5);
    expect(result.guides).toEqual([{ axis: 'x', value: 960 }]);
  });
});

describe('fitBoxToPicture', () => {
  const noCrop = { left: 0, right: 0, top: 0, bottom: 0 };
  const fullFrame = box({ x: 0, y: 0, width: 1920, height: 1080 });

  it('shrinks the box onto a narrow window around the same centre', () => {
    const fitted = fitBoxToPicture(fullFrame, noCrop, { width: 800, height: 1000 }, 'contain');
    expect(fitted).toMatchObject({ x: 528, y: 0, width: 864, height: 1080 });
  });

  it('leaves a box that already matches the picture, and ignores a minimised window', () => {
    expect(fitBoxToPicture(fullFrame, noCrop, { width: 1280, height: 720 }, 'contain')).toBeNull();
    expect(fitBoxToPicture(fullFrame, noCrop, { width: 1, height: 1 }, 'contain')).toBeNull();
  });

  it('frames only the part of the picture left after cropping', () => {
    const crop = { ...noCrop, left: 0.25, right: 0.25 };
    expect(fitBoxToPicture(fullFrame, crop, { width: 1280, height: 720 }, 'contain')).toMatchObject({
      width: 960,
      height: 1080,
    });
  });

  it('returns to the same box when the window changes shape and back', () => {
    const wide = box({ x: 0, y: 0, width: 1000, height: 500 });
    const tall = fitBoxToPicture(wide, noCrop, { width: 400, height: 800 }, 'keep-longest')!;
    expect(tall).toMatchObject({ x: 250, y: -250, width: 500, height: 1000 });
    expect(fitBoxToPicture(tall, noCrop, { width: 800, height: 400 }, 'keep-longest')).toMatchObject({
      x: 0,
      y: 0,
      width: 1000,
      height: 500,
    });
  });

  it('keeps a rotated picture centred where it was', () => {
    const turned = box({ rotation: 90, anchorX: 0, anchorY: 0 });
    const centre = applyAffine(transformAffine(turned), { x: 100, y: 50 });
    const fitted = fitBoxToPicture(turned, noCrop, { width: 100, height: 100 }, 'contain')!;
    const fittedCentre = applyAffine(transformAffine(fitted), { x: 50, y: 50 });
    expect(fitted).toMatchObject({ width: 100, height: 100 });
    expect(fittedCentre.x).toBeCloseTo(centre.x);
    expect(fittedCentre.y).toBeCloseTo(centre.y);
  });
});
