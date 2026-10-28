import { z } from 'zod';

import { displayNameSchema } from '../display-name.schema';
import { elementEffectSchema } from '../effects/element-effects.schema';

const idSchema = z.string().min(1);

export const transform2DSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  scaleX: z.number().positive(),
  scaleY: z.number().positive(),
  rotation: z.number(),
  anchorX: z.number().min(0).max(1),
  anchorY: z.number().min(0).max(1),
  flipX: z.boolean(),
  flipY: z.boolean(),
  keepAspectRatio: z.boolean(),
});

export const elementCropSchema = z
  .object({
    left: z.number().min(0).max(1),
    right: z.number().min(0).max(1),
    top: z.number().min(0).max(1),
    bottom: z.number().min(0).max(1),
  })
  .strict();

export const appearanceSchema = z.object({
  opacity: z.number().min(0).max(1),
  blendMode: z.enum(['normal', 'multiply', 'screen', 'add']).optional(),
});

const fitModeSchema = z.enum(['contain', 'cover', 'fill', 'none']);

export const visualFitSettingsSchema = z.object({
  fitMode: fitModeSchema,
  cornerRadius: z.number().min(0),
  maskSourceId: idSchema.nullable(),
});

export const sceneElementBaseFields = {
  id: idSchema,
  name: displayNameSchema,
  parentGroupId: idSchema.nullable(),
  transform: transform2DSchema,
  crop: elementCropSchema,
  appearance: appearanceSchema,
  effects: z.array(elementEffectSchema),
  visibility: z.boolean(),
  locked: z.boolean(),
};
