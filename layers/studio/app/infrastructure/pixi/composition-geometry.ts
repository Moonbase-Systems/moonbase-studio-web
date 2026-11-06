import type { ElementCrop, FitMode, Transform2D } from '../../models/common.domain';
import type { TextAlign, TextVerticalAlign } from '../../models/scene-elements/text-element.domain';

export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type Rect = Point & Size;

export const isValidSize = (size: Size): boolean =>
  Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;

export type Letterbox = { scale: number; offsetX: number; offsetY: number };

/** Fits the project frame into the canvas, centred, preserving aspect ratio. */
export const letterboxComposition = (composition: Size, viewport: Size): Letterbox => {
  const scale = Math.min(viewport.width / composition.width, viewport.height / composition.height);
  return {
    scale,
    offsetX: (viewport.width - composition.width * scale) / 2,
    offsetY: (viewport.height - composition.height * scale) / 2,
  };
};

export type ElementPlacement = {
  x: number;
  y: number;
  pivotX: number;
  pivotY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
};

/** `x`/`y` are the box top-left; the anchor is the pivot for scale and rotation (degrees in the model). */
export const placementForTransform = (transform: Transform2D): ElementPlacement => {
  const pivotX = transform.anchorX * transform.width;
  const pivotY = transform.anchorY * transform.height;
  return {
    x: transform.x + pivotX,
    y: transform.y + pivotY,
    pivotX,
    pivotY,
    scaleX: transform.scaleX,
    scaleY: transform.scaleY,
    rotation: (transform.rotation * Math.PI) / 180,
  };
};

/** Crop edges are fractions of the source size. */
export const cropFrame = (crop: ElementCrop, source: Size): Rect => {
  const left = Math.min(Math.max(crop.left, 0), 1);
  const top = Math.min(Math.max(crop.top, 0), 1);
  const width = Math.max(1, source.width * (1 - left - Math.max(crop.right, 0)));
  const height = Math.max(1, source.height * (1 - top - Math.max(crop.bottom, 0)));
  return {
    x: Math.min(source.width * left, source.width - 1),
    y: Math.min(source.height * top, source.height - 1),
    width: Math.min(width, source.width),
    height: Math.min(height, source.height),
  };
};

export const fitContentRect = (fitMode: FitMode, box: Size, content: Size): Rect => {
  if (fitMode === 'fill') {
    return { x: 0, y: 0, width: box.width, height: box.height };
  }
  const scale =
    fitMode === 'contain'
      ? Math.min(box.width / content.width, box.height / content.height)
      : fitMode === 'cover'
        ? Math.max(box.width / content.width, box.height / content.height)
        : 1;
  const width = content.width * scale;
  const height = content.height * scale;
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
};

export const alignTextBlock = (
  align: TextAlign,
  verticalAlign: TextVerticalAlign,
  box: Size,
  block: Size,
  padding: number,
): Point => {
  const x =
    align === 'center'
      ? (box.width - block.width) / 2
      : align === 'right'
        ? box.width - padding - block.width
        : padding;
  const y =
    verticalAlign === 'middle'
      ? (box.height - block.height) / 2
      : verticalAlign === 'bottom'
        ? box.height - padding - block.height
        : padding;
  return { x, y };
};

/** Linear gradient endpoints in local 0–1 space; 0° runs left to right, angles grow clockwise. */
export const linearGradientPoints = (angleDegrees: number): { start: Point; end: Point } => {
  const radians = (angleDegrees * Math.PI) / 180;
  const dx = Math.cos(radians) / 2;
  const dy = Math.sin(radians) / 2;
  return {
    start: { x: 0.5 - dx, y: 0.5 - dy },
    end: { x: 0.5 + dx, y: 0.5 + dy },
  };
};

export const FONT_WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'] as const;
export type CompositionFontWeight = 'normal' | 'bold' | (typeof FONT_WEIGHTS)[number];

export const toFontWeight = (weight: string | number): CompositionFontWeight => {
  if (weight === 'normal' || weight === 'bold') {
    return weight;
  }
  const numeric = typeof weight === 'number' ? weight : Number(weight);
  if (!Number.isFinite(numeric)) {
    return 'normal';
  }
  const rounded = Math.min(900, Math.max(100, Math.round(numeric / 100) * 100));
  return FONT_WEIGHTS.find((value) => Number(value) === rounded) ?? 'normal';
};
