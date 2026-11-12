import { planSceneSync } from '../infrastructure/pixi/composition-scene-sync';
import type { ElementCrop, Transform2D } from '../models/common.domain';
import type { ElementId } from '../models/ids.domain';
import type { Scene } from '../models/scene.domain';
import type { SceneElement } from '../models/scene-element.domain';
import type { SceneGroup } from '../models/scene-group.domain';

export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

/** 2D affine map: x' = a·x + c·y + tx, y' = b·x + d·y + ty. */
export type Affine = { a: number; b: number; c: number; d: number; tx: number; ty: number };

export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

/** Smallest box a resize leaves, in project pixels, so a layer never collapses out of reach. */
export const MIN_ELEMENT_SIZE = 1;

/** `outer ∘ inner`: applies `inner` first. */
export const multiplyAffine = (outer: Affine, inner: Affine): Affine => ({
  a: outer.a * inner.a + outer.c * inner.b,
  b: outer.b * inner.a + outer.d * inner.b,
  c: outer.a * inner.c + outer.c * inner.d,
  d: outer.b * inner.c + outer.d * inner.d,
  tx: outer.a * inner.tx + outer.c * inner.ty + outer.tx,
  ty: outer.b * inner.tx + outer.d * inner.ty + outer.ty,
});

export const applyAffine = (m: Affine, p: Point): Point => ({
  x: m.a * p.x + m.c * p.y + m.tx,
  y: m.b * p.x + m.d * p.y + m.ty,
});

const applyLinear = (m: Affine, v: Point): Point => ({ x: m.a * v.x + m.c * v.y, y: m.b * v.x + m.d * v.y });

export const invertAffine = (m: Affine): Affine | null => {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-12) {
    return null;
  }
  const a = m.d / det;
  const b = -m.b / det;
  const c = -m.c / det;
  const d = m.a / det;
  return { a, b, c, d, tx: -(a * m.tx + c * m.ty), ty: -(b * m.tx + d * m.ty) };
};

const radians = (degrees: number): number => (degrees * Math.PI) / 180;
const degrees = (value: number): number => (value * 180) / Math.PI;

/** Box space (0..width × 0..height) to the parent's space, matching the engine's placement. */
export const transformAffine = (t: Transform2D): Affine => {
  const pivotX = t.anchorX * t.width;
  const pivotY = t.anchorY * t.height;
  const cos = Math.cos(radians(t.rotation));
  const sin = Math.sin(radians(t.rotation));
  const a = cos * t.scaleX;
  const b = sin * t.scaleX;
  const c = -sin * t.scaleY;
  const d = cos * t.scaleY;
  return { a, b, c, d, tx: t.x + pivotX - (a * pivotX + c * pivotY), ty: t.y + pivotY - (b * pivotX + d * pivotY) };
};

/** A group also mirrors its members around its own centre. */
const groupAffine = (group: SceneGroup): Affine => {
  const t = group.transform;
  const fx = t.flipX ? -1 : 1;
  const fy = t.flipY ? -1 : 1;
  const flip: Affine = {
    a: fx,
    b: 0,
    c: 0,
    d: fy,
    tx: (t.width / 2) * (1 - fx),
    ty: (t.height / 2) * (1 - fy),
  };
  return multiplyAffine(transformAffine(t), flip);
};

export const parentAffine = (scene: Scene, element: SceneElement): Affine => {
  const group = element.parentGroupId ? scene.groups.find((item) => item.id === element.parentGroupId) : undefined;
  return group ? groupAffine(group) : IDENTITY;
};

/** Box space to project pixels. */
export const elementAffine = (scene: Scene, element: SceneElement, transform = element.transform): Affine =>
  multiplyAffine(parentAffine(scene, element), transformAffine(transform));

export const boxCorners = (affine: Affine, size: Size): Point[] =>
  [
    { x: 0, y: 0 },
    { x: size.width, y: 0 },
    { x: size.width, y: size.height },
    { x: 0, y: size.height },
  ].map((corner) => applyAffine(affine, corner));

const containsPoint = (affine: Affine, size: Size, point: Point): boolean => {
  const inverse = invertAffine(affine);
  if (!inverse) {
    return false;
  }
  const local = applyAffine(inverse, point);
  return local.x >= 0 && local.y >= 0 && local.x <= size.width && local.y <= size.height;
};

/** Drawn elements bottom to top, in the order the engine composites them. */
export const elementsInDrawOrder = (scene: Scene): SceneElement[] =>
  planSceneSync(scene, { elementIds: new Set(), groupIds: new Set() }).roots.flatMap((root) =>
    root.kind === 'element' ? [root.element] : root.members,
  );

/** The topmost visible element whose box covers the point (project pixels). */
export const hitTestScene = (scene: Scene, point: Point): SceneElement | null => {
  return hitTestSceneExcluding(scene, point, null);
};

/**
 * Like {@link hitTestScene}, but skips the given element ids (e.g. the layer being dragged).
 */
export const hitTestSceneExcluding = (
  scene: Scene,
  point: Point,
  excludeIds: ElementId | ReadonlySet<ElementId> | null,
): SceneElement | null => {
  const excluded =
    excludeIds == null ? null : typeof excludeIds === 'string' ? new Set<ElementId>([excludeIds]) : excludeIds;
  const ordered = elementsInDrawOrder(scene);
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const element = ordered[index]!;
    if (excluded?.has(element.id)) {
      continue;
    }
    if (element.visibility && containsPoint(elementAffine(scene, element), element.transform, point)) {
      return element;
    }
  }
  return null;
};

/** True when `aboveId` is already higher in the draw stack than `belowId`. */
export const drawsAbove = (scene: Scene, aboveId: ElementId, belowId: ElementId): boolean => {
  const ordered = elementsInDrawOrder(scene);
  const aboveIndex = ordered.findIndex((element) => element.id === aboveId);
  const belowIndex = ordered.findIndex((element) => element.id === belowId);
  return aboveIndex !== -1 && belowIndex !== -1 && aboveIndex > belowIndex;
};

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export type Handle = { id: HandleId; dx: -1 | 0 | 1; dy: -1 | 0 | 1 };

export const HANDLES: readonly Handle[] = [
  { id: 'nw', dx: -1, dy: -1 },
  { id: 'n', dx: 0, dy: -1 },
  { id: 'ne', dx: 1, dy: -1 },
  { id: 'e', dx: 1, dy: 0 },
  { id: 'se', dx: 1, dy: 1 },
  { id: 's', dx: 0, dy: 1 },
  { id: 'sw', dx: -1, dy: 1 },
  { id: 'w', dx: -1, dy: 0 },
];

const handleLocal = (handle: Handle, size: Size): Point => ({
  x: ((1 + handle.dx) / 2) * size.width,
  y: ((1 + handle.dy) / 2) * size.height,
});

export const handlePoint = (affine: Affine, size: Size, handle: Handle): Point =>
  applyAffine(affine, handleLocal(handle, size));

const isCorner = (handle: Handle): boolean => handle.dx !== 0 && handle.dy !== 0;

/** The handle nearest to the point within `radius` (project pixels). */
export const pickHandle = (
  affine: Affine,
  size: Size,
  point: Point,
  radius: number,
  candidates: readonly Handle[] = HANDLES,
): Handle | null => {
  let best: { handle: Handle; distance: number } | null = null;
  for (const handle of candidates) {
    const at = handlePoint(affine, size, handle);
    const distance = Math.hypot(at.x - point.x, at.y - point.y);
    if (distance <= radius && (!best || distance < best.distance)) {
      best = { handle, distance };
    }
  }
  return best?.handle ?? null;
};

const CORNERS = HANDLES.filter(isCorner);
const SIDES = HANDLES.filter((handle) => !isCorner(handle));

/** The corner nearest to the point within `radius` (project pixels), inside or outside the box. */
export const pickCorner = (affine: Affine, size: Size, point: Point, radius: number): Handle | null =>
  pickHandle(affine, size, point, radius, CORNERS);

const distanceToSegment = (point: Point, from: Point, to: Point): number => {
  const span = { x: to.x - from.x, y: to.y - from.y };
  const lengthSquared = span.x * span.x + span.y * span.y;
  const along =
    lengthSquared > 0
      ? Math.min(Math.max(((point.x - from.x) * span.x + (point.y - from.y) * span.y) / lengthSquared, 0), 1)
      : 0;
  return Math.hypot(point.x - (from.x + span.x * along), point.y - (from.y + span.y * along));
};

/** The side (n, e, s or w) whose edge passes within `radius` of the point (project pixels). */
export const pickSide = (affine: Affine, size: Size, point: Point, radius: number): Handle | null => {
  let best: { handle: Handle; distance: number } | null = null;
  for (const handle of SIDES) {
    const ends = [
      { x: handle.dx === 0 ? -1 : handle.dx, y: handle.dy === 0 ? -1 : handle.dy },
      { x: handle.dx === 0 ? 1 : handle.dx, y: handle.dy === 0 ? 1 : handle.dy },
    ].map((end) => applyAffine(affine, { x: ((1 + end.x) / 2) * size.width, y: ((1 + end.y) / 2) * size.height }));
    const distance = distanceToSegment(point, ends[0]!, ends[1]!);
    if (distance <= radius && (!best || distance < best.distance)) {
      best = { handle, distance };
    }
  }
  return best?.handle ?? null;
};

/** Screen captures always scale with their proportions, like a window in OBS. */
export const keepsAspectRatio = (element: SceneElement): boolean =>
  element.type === 'screen' || element.transform.keepAspectRatio;

/** Media whose picture can be trimmed from the sides. */
export const canCrop = (element: SceneElement): boolean => element.type === 'image' || element.type === 'screen';

/** CSS resize cursor along the handle's on-screen direction. */
export const handleCursor = (affine: Affine, handle: Handle): string => {
  const direction = applyLinear(affine, { x: handle.dx, y: handle.dy });
  const angle = (((degrees(Math.atan2(direction.y, direction.x)) % 180) + 180) % 180) / 45;
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][Math.round(angle) % 4]!;
};

/**
 * Moves the pivot to the box centre without moving the picture, so rotation and resizing work around
 * the middle of the element.
 */
export const centreAnchor = (t: Transform2D): Transform2D => {
  if (t.anchorX === 0.5 && t.anchorY === 0.5) {
    return t;
  }
  const pivot = applyAffine(transformAffine(t), { x: t.width / 2, y: t.height / 2 });
  return { ...t, anchorX: 0.5, anchorY: 0.5, x: pivot.x - t.width / 2, y: pivot.y - t.height / 2 };
};

/** Captures smaller than this are a minimised window, not a real picture to frame. */
const MIN_PICTURE_SIZE = 16;
const ASPECT_TOLERANCE = 0.002;

/**
 * The box reshaped to the picture's proportions around the same centre, like a window source in OBS.
 * `contain` shrinks the box onto the picture it already shows; `keep-longest` keeps the longer side, so
 * a window that changes shape back and forth returns to the same box. Null when the box already fits.
 */
export const fitBoxToPicture = (
  transform: Transform2D,
  crop: ElementCrop,
  picture: Size,
  mode: 'contain' | 'keep-longest',
): Transform2D | null => {
  if (picture.width < MIN_PICTURE_SIZE || picture.height < MIN_PICTURE_SIZE) {
    return null;
  }
  const visibleWidth = picture.width * Math.max(1 - crop.left - crop.right, 0);
  const visibleHeight = picture.height * Math.max(1 - crop.top - crop.bottom, 0);
  if (visibleWidth <= 0 || visibleHeight <= 0 || transform.width <= 0 || transform.height <= 0) {
    return null;
  }
  const aspect = visibleWidth / visibleHeight;
  if (Math.abs(transform.width / transform.height / aspect - 1) <= ASPECT_TOLERANCE) {
    return null;
  }
  const bound =
    mode === 'contain'
      ? { width: transform.width, height: transform.height }
      : { width: Math.max(transform.width, transform.height), height: Math.max(transform.width, transform.height) };
  const scale = Math.min(bound.width / visibleWidth, bound.height / visibleHeight);
  const width = tidy(Math.max(visibleWidth * scale, MIN_ELEMENT_SIZE));
  const height = tidy(Math.max(visibleHeight * scale, MIN_ELEMENT_SIZE));
  const start = centreAnchor(transform);
  const centre = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
  return { ...start, width, height, x: tidy(centre.x - width / 2), y: tidy(centre.y - height / 2) };
};

export type SnapGuide = { axis: 'x' | 'y'; value: number };

/** Frame to snap against, in project pixels; `threshold` is the pull distance in project pixels. */
export type SnapTarget = { frame: Size; threshold: number };

export type GestureResult = { transform: Partial<Transform2D>; guides: SnapGuide[] };

type AxisSnap = { delta: number; line: number };

const snapAxis = (positions: number[], length: number, threshold: number): AxisSnap | null => {
  let best: AxisSnap | null = null;
  for (const position of positions) {
    for (const line of [0, length / 2, length]) {
      const delta = line - position;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, line };
      }
    }
  }
  return best;
};

const guidesFor = (x: AxisSnap | null, y: AxisSnap | null): SnapGuide[] => [
  ...(x ? [{ axis: 'x' as const, value: x.line }] : []),
  ...(y ? [{ axis: 'y' as const, value: y.line }] : []),
];

const tidy = (value: number): number => Math.round(value * 100) / 100;

const worldToParentDelta = (parent: Affine, delta: Point): Point => {
  const inverse = invertAffine(parent);
  return inverse ? applyLinear(inverse, delta) : delta;
};

/** `start` must have a centred anchor (see `centreAnchor`); `delta` is in project pixels. */
export const moveElement = (
  start: Transform2D,
  parent: Affine,
  delta: Point,
  snap: SnapTarget | null,
): GestureResult => {
  const step = worldToParentDelta(parent, delta);
  let x = start.x + step.x;
  let y = start.y + step.y;
  let guides: SnapGuide[] = [];

  if (snap) {
    const corners = boxCorners(multiplyAffine(parent, transformAffine({ ...start, x, y })), start);
    const xs = corners.map((corner) => corner.x);
    const ys = corners.map((corner) => corner.y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    const snapX = snapAxis([left, (left + right) / 2, right], snap.frame.width, snap.threshold);
    const snapY = snapAxis([top, (top + bottom) / 2, bottom], snap.frame.height, snap.threshold);
    const correction = worldToParentDelta(parent, { x: snapX?.delta ?? 0, y: snapY?.delta ?? 0 });
    x += correction.x;
    y += correction.y;
    guides = guidesFor(snapX, snapY);
  }

  return { transform: { x: tidy(x), y: tidy(y), anchorX: 0.5, anchorY: 0.5 }, guides };
};

export type ResizeOptions = { keepAspect: boolean; snap: SnapTarget | null };

/** Pointer travel in the element's box space. */
const boxMove = (start: Transform2D, parent: Affine, pointerStart: Point, pointer: Point): Point => {
  const toParent = invertAffine(parent) ?? IDENTITY;
  const fromStart = applyAffine(toParent, pointerStart);
  const toPointer = applyAffine(toParent, pointer);
  const toBox = invertAffine(transformAffine(start)) ?? IDENTITY;
  return applyLinear(toBox, { x: toPointer.x - fromStart.x, y: toPointer.y - fromStart.y });
};

/** New box size with the edge or corner opposite `handle` left where it was. */
const anchoredBox = (start: Transform2D, handle: Handle, width: number, height: number): Transform2D => {
  const local = transformAffine(start);
  const fixed = { x: ((1 - handle.dx) / 2) * start.width, y: ((1 - handle.dy) / 2) * start.height };
  const anchorPoint = applyAffine(local, fixed);
  const offset = applyLinear(local, { x: (handle.dx * width) / 2, y: (handle.dy * height) / 2 });
  return {
    ...start,
    width,
    height,
    anchorX: 0.5,
    anchorY: 0.5,
    x: anchorPoint.x + offset.x - width / 2,
    y: anchorPoint.y + offset.y - height / 2,
  };
};

/** Pulls the dragged handle onto a frame line along the axes it moves on. */
const snapDraggedHandle = (
  next: Transform2D,
  parent: Affine,
  handle: Handle,
  pointer: Point,
  snap: SnapTarget,
): { pointer: Point; guides: SnapGuide[] } | null => {
  const world = multiplyAffine(parent, transformAffine(next));
  const at = handlePoint(world, next, handle);
  const direction = applyLinear(world, { x: handle.dx, y: handle.dy });
  const length = Math.hypot(direction.x, direction.y) || 1;
  const snapX = Math.abs(direction.x) / length > 1e-3 ? snapAxis([at.x], snap.frame.width, snap.threshold) : null;
  const snapY = Math.abs(direction.y) / length > 1e-3 ? snapAxis([at.y], snap.frame.height, snap.threshold) : null;
  if (!snapX && !snapY) {
    return null;
  }
  return {
    pointer: { x: pointer.x + (snapX?.delta ?? 0), y: pointer.y + (snapY?.delta ?? 0) },
    guides: guidesFor(snapX, snapY),
  };
};

const resizeTo = (
  start: Transform2D,
  parent: Affine,
  handle: Handle,
  pointerStart: Point,
  pointer: Point,
  keepAspect: boolean,
): Transform2D => {
  const move = boxMove(start, parent, pointerStart, pointer);

  const startWidth = start.width;
  const startHeight = start.height;
  const grabbed = handleLocal(handle, start);
  const fixed = { x: ((1 - handle.dx) / 2) * startWidth, y: ((1 - handle.dy) / 2) * startHeight };

  let width = handle.dx === 0 ? startWidth : (grabbed.x + move.x - fixed.x) * handle.dx;
  let height = handle.dy === 0 ? startHeight : (grabbed.y + move.y - fixed.y) * handle.dy;
  width = Math.max(MIN_ELEMENT_SIZE, width);
  height = Math.max(MIN_ELEMENT_SIZE, height);

  if (keepAspect && startWidth > 0 && startHeight > 0) {
    let factor: number;
    if (handle.dx !== 0 && handle.dy !== 0) {
      factor = Math.max(width / startWidth, height / startHeight);
    } else if (handle.dx !== 0) {
      factor = width / startWidth;
    } else {
      factor = height / startHeight;
    }
    factor = Math.max(factor, MIN_ELEMENT_SIZE / startWidth, MIN_ELEMENT_SIZE / startHeight);
    width = startWidth * factor;
    height = startHeight * factor;
  }

  return anchoredBox(start, handle, width, height);
};

/**
 * Drags one handle while the opposite edge or corner stays put. `start` must have a centred anchor;
 * pointers are in project pixels.
 */
export const resizeElement = (
  start: Transform2D,
  parent: Affine,
  handle: Handle,
  pointerStart: Point,
  pointer: Point,
  options: ResizeOptions,
): GestureResult => {
  let next = resizeTo(start, parent, handle, pointerStart, pointer, options.keepAspect);
  let guides: SnapGuide[] = [];

  const snapped = options.snap ? snapDraggedHandle(next, parent, handle, pointer, options.snap) : null;
  if (snapped) {
    next = resizeTo(start, parent, handle, pointerStart, snapped.pointer, options.keepAspect);
    guides = snapped.guides;
  }

  return {
    transform: {
      x: tidy(next.x),
      y: tidy(next.y),
      width: tidy(next.width),
      height: tidy(next.height),
      anchorX: 0.5,
      anchorY: 0.5,
    },
    guides,
  };
};

const normaliseDegrees = (value: number): number => tidy(((value % 360) + 360) % 360) % 360;

/**
 * Turns the element around its centre by the angle the pointer swept. `step` snaps the result to
 * multiples of that many degrees. `start` must have a centred anchor.
 */
export const rotateElement = (
  start: Transform2D,
  parent: Affine,
  pointerStart: Point,
  pointer: Point,
  step: number | null,
): GestureResult => {
  const toParent = invertAffine(parent) ?? IDENTITY;
  const centre = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
  const from = applyAffine(toParent, pointerStart);
  const to = applyAffine(toParent, pointer);
  const swept = degrees(
    Math.atan2(to.y - centre.y, to.x - centre.x) - Math.atan2(from.y - centre.y, from.x - centre.x),
  );
  let rotation = start.rotation + swept;
  if (step) {
    rotation = Math.round(rotation / step) * step;
  }
  return {
    transform: { rotation: normaliseDegrees(rotation), x: start.x, y: start.y, anchorX: 0.5, anchorY: 0.5 },
    guides: [],
  };
};

export type CropResult = GestureResult & { crop: Partial<ElementCrop> };

/** Crop edge shown on a box side; a mirrored element shows the opposite edge of its picture there. */
const cropEdgeFor = (start: Transform2D, side: Handle): { near: keyof ElementCrop; far: keyof ElementCrop } => {
  if (side.dx !== 0) {
    const left = side.dx < 0 !== start.flipX;
    return left ? { near: 'left', far: 'right' } : { near: 'right', far: 'left' };
  }
  const top = side.dy < 0 !== start.flipY;
  return top ? { near: 'top', far: 'bottom' } : { near: 'bottom', far: 'top' };
};

const cropTo = (
  start: Transform2D,
  crop: ElementCrop,
  parent: Affine,
  side: Handle,
  pointerStart: Point,
  pointer: Point,
): { transform: Transform2D; crop: Partial<ElementCrop> } => {
  const move = boxMove(start, parent, pointerStart, pointer);
  const horizontal = side.dx !== 0;
  const inward = horizontal ? -side.dx * move.x : -side.dy * move.y;
  const length = horizontal ? start.width : start.height;
  const { near, far } = cropEdgeFor(start, side);
  const visible = 1 - crop[near] - crop[far];
  if (visible <= 0 || length <= 0) {
    return { transform: start, crop: {} };
  }
  const whole = length / visible;
  const nextNear = Math.min(Math.max(crop[near] + inward / whole, 0), 1 - crop[far] - MIN_ELEMENT_SIZE / whole);
  const nextLength = length - (nextNear - crop[near]) * whole;
  const transform = anchoredBox(
    start,
    side,
    horizontal ? nextLength : start.width,
    horizontal ? start.height : nextLength,
  );
  return { transform, crop: { [near]: Math.round(nextNear * 1e6) / 1e6 } };
};

/**
 * Trims the picture from one side while the rest of it stays where it is on screen: the side moves
 * with the pointer and the box shrinks or grows by the same amount. Dragging outwards gives back what
 * was cropped, never more. `start` must have a centred anchor; pointers are in project pixels.
 */
export const cropElement = (
  start: Transform2D,
  crop: ElementCrop,
  parent: Affine,
  side: Handle,
  pointerStart: Point,
  pointer: Point,
  snap: SnapTarget | null,
): CropResult => {
  let next = cropTo(start, crop, parent, side, pointerStart, pointer);
  let guides: SnapGuide[] = [];

  const snapped = snap ? snapDraggedHandle(next.transform, parent, side, pointer, snap) : null;
  if (snapped) {
    next = cropTo(start, crop, parent, side, pointerStart, snapped.pointer);
    guides = snapped.guides;
  }

  return {
    transform: {
      x: tidy(next.transform.x),
      y: tidy(next.transform.y),
      width: tidy(next.transform.width),
      height: tidy(next.transform.height),
      anchorX: 0.5,
      anchorY: 0.5,
    },
    crop: next.crop,
    guides,
  };
};
