export type BlendMode = 'normal' | 'multiply' | 'screen' | 'add';

export type Transform2D = {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  anchorX: number;
  anchorY: number;
  flipX: boolean;
  flipY: boolean;
  keepAspectRatio: boolean;
};

export type ElementCrop = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export const createDefaultElementCrop = (): ElementCrop => ({
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
});

export type Appearance = {
  opacity: number;
  blendMode?: BlendMode;
};

export type FitMode = 'contain' | 'cover' | 'fill' | 'none';

export { type ElementEffect, type ElementEffectType } from './effects';
