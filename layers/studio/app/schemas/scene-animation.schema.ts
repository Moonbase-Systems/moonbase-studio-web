import { z } from 'zod';

const idSchema = z.string().min(1);

export const sceneAnimationSchema = z.object({
  id: idSchema,
  assetId: idSchema,
  mediaKind: z.enum(['gif', 'video']),
  durationMs: z.number().positive().optional(),
  settings: z.object({
    loop: z.boolean().optional(),
    playbackRate: z.number().positive().optional(),
    fit: z.string().optional(),
  }),
});
