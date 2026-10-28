import { z } from 'zod';

const idSchema = z.string().min(1);

const elementEffectBaseFields = {
  id: idSchema,
  name: z.string().min(1).max(128),
  enabled: z.boolean(),
};

export const chromaKeyEffectSchema = z.object({
  ...elementEffectBaseFields,
  type: z.literal('chroma-key'),
  parameters: z.object({
    keyColor: z.string().min(1),
    similarity: z.number().min(0).max(1),
    smoothness: z.number().min(0).max(1),
    spill: z.number().min(0).max(1),
  }),
});

export const colorCorrectionEffectSchema = z.object({
  ...elementEffectBaseFields,
  type: z.literal('color-correction'),
  parameters: z.object({
    brightness: z.number().min(-1).max(1),
    contrast: z.number().min(-1).max(1),
    saturation: z.number().min(-1).max(1),
    hue: z.number().min(-180).max(180),
    gamma: z.number().min(0.1).max(3),
    temperature: z.number().min(-1).max(1),
  }),
});

export const blurEffectSchema = z.object({
  ...elementEffectBaseFields,
  type: z.literal('blur'),
  parameters: z.object({
    radius: z.number().min(0),
  }),
});

export const sharpenEffectSchema = z.object({
  ...elementEffectBaseFields,
  type: z.literal('sharpen'),
  parameters: z.object({
    strength: z.number().min(0).max(2),
  }),
});

export const maskEffectSchema = z.object({
  ...elementEffectBaseFields,
  type: z.literal('mask'),
  parameters: z.object({
    sourceId: idSchema,
    mode: z.enum(['alpha', 'luminance']),
    inverted: z.boolean(),
  }),
});

export const shadowEffectSchema = z.object({
  ...elementEffectBaseFields,
  type: z.literal('shadow'),
  parameters: z.object({
    color: z.string().min(1),
    offsetX: z.number(),
    offsetY: z.number(),
    blur: z.number().min(0),
    opacity: z.number().min(0).max(1),
  }),
});

export const outlineEffectSchema = z.object({
  ...elementEffectBaseFields,
  type: z.literal('outline'),
  parameters: z.object({
    color: z.string().min(1),
    width: z.number().min(0),
    opacity: z.number().min(0).max(1),
  }),
});

export const elementEffectSchema = z.discriminatedUnion('type', [
  chromaKeyEffectSchema,
  colorCorrectionEffectSchema,
  blurEffectSchema,
  sharpenEffectSchema,
  maskEffectSchema,
  shadowEffectSchema,
  outlineEffectSchema,
]);
