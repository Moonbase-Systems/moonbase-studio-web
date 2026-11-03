import { z } from 'zod';

const animationTriggerSchema = z.enum([
  'manual',
  'on-activate',
  'on-scene-start',
  'on-appear',
  'on-click',
  'after-delay',
  'interval',
]);

export const animationSourceSettingsSchema = z.object({
  mediaKind: z.enum(['gif', 'video']),
  format: z.enum(['gif', 'webp', 'apng', 'webm', 'mp4']).optional(),
  assetId: z.string().min(1).optional(),
  startFrame: z.number().int().nonnegative(),
  startOffsetMs: z.number().int().nonnegative(),
  startPositionMs: z.number().int().nonnegative().default(0),
  durationMs: z.number().int().positive().nullable(),
  trigger: animationTriggerSchema,
  intervalMs: z.number().int().positive().nullable(),
  playbackMode: z.enum(['once', 'loop']).default('once'),
  repeatCount: z.number().int().positive().nullable().default(1),
  playbackRate: z.number().positive().max(8).default(1),
  pauseOnHide: z.boolean().default(true),
  resetOnSceneStart: z.boolean().default(false),
  endBehavior: z.enum(['hold', 'reset', 'hide', 'stop']).default('hold'),
  volume: z.number().min(0).max(1).default(1),
});
