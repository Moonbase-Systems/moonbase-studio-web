import { sourceContentSize } from '../../application/element-frame';
import {
  cropFrame,
  fitContentRect,
  letterboxComposition,
  type Size,
} from '../../infrastructure/pixi/composition-geometry';
import type { BlendMode } from '../../models/common.domain';
import type { Project } from '../../models/project.domain';
import type { Scene } from '../../models/scene.domain';
import type { SceneElement } from '../../models/scene-element.domain';
import {
  type Affine,
  applyAffine,
  elementAffine,
  invertAffine,
  multiplyAffine,
  type Point,
} from '../../playback/scene-element-gesture';

/**
 * Layers this close to opaque hide the field. The engine paints these boxes:
 * audio draws nothing; text only its background; shapes their filled geometry;
 * image and screen the fitted picture when its size is known; every other
 * visible layer is still a placeholder that fills its transform.
 */
const COVER_OPACITY = 0.92;

type BoxCover = {
  id: string;
  kind: 'box' | 'ellipse' | 'triangle';
  inverse: Affine;
  width: number;
  height: number;
};

export type SignalCover = { id: string; kind: 'frame' } | BoxCover;

const blendsSolid = (blendMode: BlendMode | undefined): boolean => blendMode === undefined || blendMode === 'normal';

const inTriangle = (x: number, y: number, width: number, height: number): boolean => {
  const denom = width * height;
  if (denom <= 0) {
    return false;
  }
  const u = (height - y) / height;
  const v = x / width + (y - height) / (2 * height);
  return u >= 0 && v >= 0 && u + v <= 1;
};

const hitCover = (cover: SignalCover, point: Point, composition: Size): boolean => {
  if (cover.kind === 'frame') {
    return (
      point.x >= -0.5 && point.y >= -0.5 && point.x <= composition.width + 0.5 && point.y <= composition.height + 0.5
    );
  }
  const local = applyAffine(cover.inverse, point);
  if (cover.kind === 'ellipse') {
    const rx = cover.width / 2;
    const ry = cover.height / 2;
    if (rx <= 0 || ry <= 0) {
      return false;
    }
    const dx = local.x - rx;
    const dy = local.y - ry;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
  }
  if (cover.kind === 'triangle') {
    return inTriangle(local.x, local.y, cover.width, cover.height);
  }
  return local.x >= -0.5 && local.y >= -0.5 && local.x <= cover.width + 0.5 && local.y <= cover.height + 0.5;
};

const boxCover = (
  id: string,
  affine: Affine,
  x: number,
  y: number,
  width: number,
  height: number,
  kind: BoxCover['kind'] = 'box',
): SignalCover | null => {
  if (!(width > 0) || !(height > 0)) {
    return null;
  }
  const forward = multiplyAffine(affine, { a: 1, b: 0, c: 0, d: 1, tx: x, ty: y });
  const inverse = invertAffine(forward);
  if (!inverse) {
    return null;
  }
  return { id, kind, inverse, width, height };
};

/** Picture rect actually drawn for an image or screen, clipped to the layer box. */
const fittedCover = (
  element: SceneElement,
  project: Project | null | undefined,
  affine: Affine,
): SignalCover | null => {
  if ((element.type !== 'image' && element.type !== 'screen') || !project) {
    return null;
  }
  const source = project.sources.find((item) => item.id === element.sourceId);
  if (!source) {
    return null;
  }
  const content = sourceContentSize(project, source);
  if (!content) {
    return null;
  }
  const fit = element.settings.fitMode;
  if (fit !== 'contain' && fit !== 'none') {
    return null;
  }
  const frame = cropFrame(element.crop, content);
  const placed = fitContentRect(fit, element.transform, frame);
  const x = Math.max(0, placed.x);
  const y = Math.max(0, placed.y);
  const right = Math.min(element.transform.width, placed.x + placed.width);
  const bottom = Math.min(element.transform.height, placed.y + placed.height);
  return boxCover(element.id, affine, x, y, right - x, bottom - y);
};

const coverForElement = (
  scene: Scene,
  element: SceneElement,
  project: Project | null | undefined,
): SignalCover | null => {
  if (!element.visibility || element.type === 'audioVisual') {
    return null;
  }
  const group = element.parentGroupId ? scene.groups.find((item) => item.id === element.parentGroupId) : undefined;
  if (!blendsSolid(element.appearance.blendMode) || !blendsSolid(group?.appearance.blendMode)) {
    return null;
  }
  const opacity = element.appearance.opacity * (group?.appearance.opacity ?? 1);
  const affine = elementAffine(scene, element);
  const { width, height } = element.transform;

  if (element.type === 'text') {
    const background = element.settings.backgroundOpacity * opacity;
    if (!element.settings.backgroundColor || background < COVER_OPACITY) {
      return null;
    }
    return boxCover(element.id, affine, 0, 0, width, height);
  }
  if (element.type === 'shape') {
    const { settings } = element;
    const filled = settings.fillColor !== null || (settings.gradient?.stops.length ?? 0) > 0;
    if (!filled || settings.fillOpacity * opacity < COVER_OPACITY) {
      return null;
    }
    const kind = settings.shapeType === 'ellipse' ? 'ellipse' : settings.shapeType === 'triangle' ? 'triangle' : 'box';
    return boxCover(element.id, affine, 0, 0, width, height, kind);
  }
  if (opacity < COVER_OPACITY) {
    return null;
  }
  return fittedCover(element, project, affine) ?? boxCover(element.id, affine, 0, 0, width, height);
};

/** Opaque scene background and the pixels a layer actually paints, in project space. */
export const signalCovers = (scene: Scene | null | undefined, project?: Project | null): SignalCover[] => {
  if (!scene) {
    return [];
  }
  const covers: SignalCover[] = [];
  if (scene.background.kind !== 'none') {
    covers.push({ id: 'background', kind: 'frame' });
  }
  for (const element of scene.elements) {
    const cover = coverForElement(scene, element, project);
    if (cover) {
      covers.push(cover);
    }
  }
  return covers;
};

export const projectPointCovered = (covers: readonly SignalCover[], composition: Size, point: Point): boolean =>
  covers.some((cover) => hitCover(cover, point, composition));

/** True when one cover contains the whole preview. */
export const previewFullyCovered = (covers: readonly SignalCover[], composition: Size, viewport: Size): boolean => {
  if (viewport.width <= 2 || viewport.height <= 2) {
    return false;
  }
  const letter = letterboxComposition(composition, viewport);
  if (!(letter.scale > 0)) {
    return false;
  }
  const inset = 1;
  const corners = [
    { x: inset, y: inset },
    { x: viewport.width - inset, y: inset },
    { x: viewport.width - inset, y: viewport.height - inset },
    { x: inset, y: viewport.height - inset },
  ];
  return covers.some((cover) =>
    corners.every((corner) =>
      hitCover(
        cover,
        {
          x: (corner.x - letter.offsetX) / letter.scale,
          y: (corner.y - letter.offsetY) / letter.scale,
        },
        composition,
      ),
    ),
  );
};
