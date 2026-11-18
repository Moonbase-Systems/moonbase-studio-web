import { z } from 'zod';

/** Positive finite number. Frame rate may be fractional (29.97, 59.94, 23.976). */
export const outputFrameNumberSchema = z.number().finite().positive();

export const outputProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(128),
  width: outputFrameNumberSchema,
  height: outputFrameNumberSchema,
  frameRate: outputFrameNumberSchema,
  originPresetId: z.string().min(1).nullable(),
});
