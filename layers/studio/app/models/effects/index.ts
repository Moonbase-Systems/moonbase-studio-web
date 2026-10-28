import type { BlurEffect } from './blur-effect.domain';
import type { ChromaKeyEffect } from './chroma-key-effect.domain';
import type { ColorCorrectionEffect } from './color-correction-effect.domain';
import type { MaskEffect } from './mask-effect.domain';
import type { OutlineEffect } from './outline-effect.domain';
import type { ShadowEffect } from './shadow-effect.domain';
import type { SharpenEffect } from './sharpen-effect.domain';

export type ElementEffect =
  | ChromaKeyEffect
  | ColorCorrectionEffect
  | BlurEffect
  | SharpenEffect
  | MaskEffect
  | ShadowEffect
  | OutlineEffect;

export type ElementEffectType = ElementEffect['type'];

export * from './blur-effect.domain';
export * from './chroma-key-effect.domain';
export * from './color-correction-effect.domain';
export * from './effect-base.domain';
export * from './mask-effect.domain';
export * from './outline-effect.domain';
export * from './shadow-effect.domain';
export * from './sharpen-effect.domain';

/** Effect types allowed per scene element type (empty = none). */
export const allowedEffectTypesForElement = (elementType: string): ElementEffectType[] => {
  if (elementType === 'audioVisual') {
    return [];
  }
  if (elementType === 'text' || elementType === 'shape') {
    return ['color-correction', 'blur', 'sharpen', 'shadow', 'outline'];
  }
  return ['chroma-key', 'color-correction', 'blur', 'sharpen', 'mask', 'shadow', 'outline'];
};
