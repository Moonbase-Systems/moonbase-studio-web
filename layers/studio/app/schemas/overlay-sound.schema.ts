import { z } from 'zod';

import {
  createDefaultOverlayBus,
  OVERLAY_BUS_INSTANCES_MAX,
  OVERLAY_BUS_INSTANCES_MIN,
  OVERLAY_COOLDOWN_MS_MAX,
  OVERLAY_CUE_EVENTS,
  OVERLAY_FADER_DB_MAX,
  OVERLAY_FADER_DB_MIN,
  OVERLAY_PLAYBACK_RATE_MAX,
  OVERLAY_PLAYBACK_RATE_MIN,
  OVERLAY_SOUND_INSTANCES_MAX,
  OVERLAY_SOUND_INSTANCES_MIN,
  OVERLAY_VOLUME_DB_MAX,
  OVERLAY_VOLUME_DB_MIN,
} from '../models/overlay-sound.domain';
import { audioEffectSchema } from './audio-effect.schema';

const idSchema = z.string().min(1);

const endAfterStart = (
  sound: { startTimeSec: number; endTimeSec?: number },
  ctx: { addIssue: (issue: { code: 'custom'; message: string; path: (string | number)[] }) => void },
) => {
  if (sound.endTimeSec !== undefined && sound.endTimeSec <= sound.startTimeSec) {
    ctx.addIssue({
      code: 'custom',
      message: 'endTimeSec must be after startTimeSec',
      path: ['endTimeSec'],
    });
  }
};

const overlaySoundObject = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(64),
  assetId: idSchema,
  volumeDb: z.number().min(OVERLAY_VOLUME_DB_MIN).max(OVERLAY_VOLUME_DB_MAX).default(0),
  muted: z.boolean().default(false),
  enabled: z.boolean().default(true),
  loop: z.boolean().default(false),
  startTimeSec: z.number().min(0).default(0),
  endTimeSec: z.number().min(0).optional(),
  playbackRate: z.number().min(OVERLAY_PLAYBACK_RATE_MIN).max(OVERLAY_PLAYBACK_RATE_MAX).default(1),
  maxInstances: z.number().int().min(OVERLAY_SOUND_INSTANCES_MIN).max(OVERLAY_SOUND_INSTANCES_MAX).default(4),
  cooldownMs: z.number().int().min(0).max(OVERLAY_COOLDOWN_MS_MAX).default(0),
  restartPolicy: z.enum(['allow', 'restart', 'ignore', 'queue']).default('allow'),
});

export const overlaySoundSchema = overlaySoundObject.superRefine(endAfterStart);

const overlayTriggerSchema = z.object({
  id: idSchema,
  soundId: idSchema,
  event: z.enum(OVERLAY_CUE_EVENTS),
  enabled: z.boolean().default(true),
  sceneId: idSchema.optional(),
  elementId: idSchema.optional(),
});

export const overlayBusSchema = z.object({
  faderDb: z.number().min(OVERLAY_FADER_DB_MIN).max(OVERLAY_FADER_DB_MAX).default(0),
  muted: z.boolean().default(false),
  solo: z.boolean().default(false),
  monitoring: z.enum(['off', 'monitor', 'monitor-and-output']).default('off'),
  effects: z.array(audioEffectSchema).default([]),
  maxInstances: z.number().int().min(OVERLAY_BUS_INSTANCES_MIN).max(OVERLAY_BUS_INSTANCES_MAX).default(16),
  sceneChangePolicy: z.enum(['continue', 'stop-scene-sounds', 'stop-all-overlay-sounds']).default('continue'),
  sounds: z.array(overlaySoundSchema).default([]),
  triggers: z.array(overlayTriggerSchema).default([]),
});

/**
 * A format-3 file that never stored the bus still parses. Each miss gets a fresh object,
 * so one project cannot mutate the default shared with the next file.
 */
export const overlayBusFieldSchema = z.preprocess((value) => value ?? createDefaultOverlayBus(), overlayBusSchema);

export const overlaySoundDraftSchema = overlaySoundObject.omit({ id: true }).superRefine(endAfterStart);

export const overlayBusChangesSchema = z
  .object({
    faderDb: z.number().min(OVERLAY_FADER_DB_MIN).max(OVERLAY_FADER_DB_MAX).optional(),
    muted: z.boolean().optional(),
    solo: z.boolean().optional(),
    monitoring: z.enum(['off', 'monitor', 'monitor-and-output']).optional(),
    maxInstances: z.number().int().min(OVERLAY_BUS_INSTANCES_MIN).max(OVERLAY_BUS_INSTANCES_MAX).optional(),
    sceneChangePolicy: z.enum(['continue', 'stop-scene-sounds', 'stop-all-overlay-sounds']).optional(),
  })
  .strict();
