import { z } from 'zod';

import { sceneAnimationSchema } from '../scene-animation.schema';
import { sceneElementBaseFields, visualFitSettingsSchema } from './element-shared.schema';

const idSchema = z.string().min(1);

export const imageSettingsSchema = visualFitSettingsSchema
  .extend({
    smoothing: z.boolean(),
  })
  .strict();

export const videoSettingsSchema = visualFitSettingsSchema
  .extend({
    loop: z.boolean(),
    autoplay: z.boolean(),
    restartOnSceneActivate: z.boolean(),
    playbackRate: z.number().positive(),
    muted: z.boolean(),
    volume: z.number().min(0).max(1),
    startTime: z.number().min(0),
    endTime: z.number().min(0).nullable(),
  })
  .strict();

export const cameraSettingsSchema = visualFitSettingsSchema
  .extend({
    mirror: z.boolean(),
    preferredAspectRatio: z.string().nullable(),
  })
  .strict();

export const screenSettingsSchema = visualFitSettingsSchema
  .extend({
    showCursor: z.boolean(),
  })
  .strict();

const textShadowSchema = z.object({
  color: z.string().min(1),
  offsetX: z.number(),
  offsetY: z.number(),
  blur: z.number().min(0),
  opacity: z.number().min(0).max(1),
});

export const textSettingsSchema = z
  .object({
    text: z.string(),
    fontFamily: z.string().min(1),
    fontSize: z.number().positive(),
    fontWeight: z.union([z.string(), z.number()]),
    fontStyle: z.enum(['normal', 'italic']),
    color: z.string().min(1),
    textAlign: z.enum(['left', 'center', 'right']),
    verticalAlign: z.enum(['top', 'middle', 'bottom']),
    lineHeight: z.number().positive(),
    letterSpacing: z.number(),
    wrap: z.boolean(),
    overflow: z.enum(['clip', 'ellipsis', 'visible']),
    maxLines: z.number().int().positive().nullable(),
    backgroundColor: z.string().nullable(),
    backgroundOpacity: z.number().min(0).max(1),
    padding: z.number().min(0),
    strokeColor: z.string().nullable(),
    strokeWidth: z.number().min(0),
    shadow: textShadowSchema.nullable(),
  })
  .strict();

const shapeGradientStopSchema = z.object({
  offset: z.number().min(0).max(1),
  color: z.string().min(1),
});

const shapeGradientSchema = z.object({
  type: z.enum(['linear', 'radial']),
  angle: z.number(),
  stops: z.array(shapeGradientStopSchema).min(1),
});

export const shapeSettingsSchema = z
  .object({
    shapeType: z.enum(['rectangle', 'ellipse', 'line']),
    fillColor: z.string().nullable(),
    fillOpacity: z.number().min(0).max(1),
    strokeColor: z.string().nullable(),
    strokeWidth: z.number().min(0),
    cornerRadius: z.number().min(0),
    gradient: shapeGradientSchema.nullable(),
  })
  .strict();

export const audioSettingsSchema = z
  .object({
    volume: z.number().min(0).max(1),
    muted: z.boolean(),
    pan: z.number().min(-1).max(1),
    syncOffsetMs: z.number(),
    monitoring: z.enum(['off', 'monitor', 'monitor-and-output']),
  })
  .strict();

const emptySettingsSchema = z.object({}).strict();

export const sourceBackedElementSchema = z.discriminatedUnion('type', [
  z.object({
    ...sceneElementBaseFields,
    type: z.literal('camera'),
    sourceId: idSchema,
    settings: cameraSettingsSchema,
  }),
  z.object({
    ...sceneElementBaseFields,
    type: z.literal('screen'),
    sourceId: idSchema,
    settings: screenSettingsSchema,
  }),
  z.object({
    ...sceneElementBaseFields,
    type: z.literal('image'),
    sourceId: idSchema,
    settings: imageSettingsSchema,
  }),
  z.object({
    ...sceneElementBaseFields,
    type: z.literal('video'),
    sourceId: idSchema,
    settings: videoSettingsSchema,
  }),
  z.object({
    ...sceneElementBaseFields,
    type: z.literal('text'),
    sourceId: idSchema,
    settings: textSettingsSchema,
  }),
  z.object({
    ...sceneElementBaseFields,
    type: z.literal('shape'),
    sourceId: idSchema,
    settings: shapeSettingsSchema,
  }),
  z.object({
    ...sceneElementBaseFields,
    type: z.literal('browser'),
    sourceId: idSchema,
    settings: emptySettingsSchema,
  }),
  z.object({
    ...sceneElementBaseFields,
    type: z.literal('audioVisual'),
    sourceId: idSchema,
    settings: audioSettingsSchema,
  }),
  z.object({
    ...sceneElementBaseFields,
    type: z.literal('animation'),
    sourceId: idSchema,
    settings: emptySettingsSchema,
  }),
]);

export const overlayElementSchema = z.object({
  ...sceneElementBaseFields,
  type: z.literal('overlay'),
  overlayKind: z.string().min(1),
  content: z.record(z.string(), z.unknown()),
  animations: z.array(sceneAnimationSchema),
});

export const sceneElementSchema = z.union([sourceBackedElementSchema, overlayElementSchema]);
