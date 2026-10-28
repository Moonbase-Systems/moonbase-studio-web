import { z } from 'zod';

import { sceneAnimationSchema } from './scene-animation.schema';
import { appearanceSchema, transform2DSchema } from './scene-elements/element-shared.schema';
import { overlayElementSchema, sourceBackedElementSchema } from './scene-elements/scene-element.schema';

const idSchema = z.string().min(1);

const assetLocationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('storageKey'), key: z.string().min(1) }),
  z.object({ kind: z.literal('remoteUrl'), url: z.string().url() }),
]);

const assetSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(256),
  type: z.enum(['image', 'video', 'audio', 'gif', 'other']),
  location: assetLocationSchema,
  availability: z.enum(['available', 'missing', 'pending']),
  metadata: z
    .object({
      mimeType: z.string().optional(),
      byteSize: z.number().nonnegative().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      durationMs: z.number().nonnegative().optional(),
    })
    .optional(),
});

const browserRefreshSettingsSchema = z.object({
  intervalMs: z.number().positive().nullable(),
  refreshOnActivate: z.boolean(),
  bypassCache: z.boolean(),
});

const sourceBaseFields = {
  id: idSchema,
  name: z.string().min(1).max(128),
  metadata: z.object({ notes: z.string().optional() }).optional(),
};

const cameraSourceSettingsSchema = z.object({
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  frameRate: z.number().positive().optional(),
  audioInputDeviceId: z.string().optional(),
});

const screenSourceSettingsSchema = z.object({
  captureTarget: z.enum(['display', 'window']).optional(),
});

const sourceSchema = z.discriminatedUnion('type', [
  z.object({
    ...sourceBaseFields,
    type: z.literal('browser'),
    url: z.string().url(),
    width: z.number().positive(),
    height: z.number().positive(),
    refreshSettings: browserRefreshSettingsSchema,
  }),
  z.object({
    ...sourceBaseFields,
    type: z.literal('camera'),
    deviceId: z.string().optional(),
    settings: cameraSourceSettingsSchema.optional(),
  }),
  z.object({
    ...sourceBaseFields,
    type: z.literal('screen'),
    displayId: z.string().optional(),
    settings: screenSourceSettingsSchema.optional(),
  }),
  z.object({
    ...sourceBaseFields,
    type: z.literal('image'),
    assetId: idSchema,
  }),
  z.object({
    ...sourceBaseFields,
    type: z.literal('video'),
    assetId: idSchema,
    loop: z.boolean().optional(),
  }),
  z.object({
    ...sourceBaseFields,
    type: z.literal('text'),
    content: z.string(),
    typography: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    ...sourceBaseFields,
    type: z.literal('shape'),
    shapeKind: z.string().min(1),
    fill: z.string().optional(),
    stroke: z.string().optional(),
  }),
  z.object({
    ...sourceBaseFields,
    type: z.literal('audio'),
    assetId: idSchema.optional(),
    deviceId: z.string().optional(),
  }),
  z.object({
    ...sourceBaseFields,
    type: z.literal('animation'),
    mediaKind: z.enum(['gif', 'video']),
    assetId: idSchema.optional(),
    startFrame: z.number().int().nonnegative(),
    startOffsetMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive().nullable(),
    trigger: z.enum(['manual', 'on-activate', 'interval']),
    intervalMs: z.number().int().positive().nullable(),
  }),
]);

const sceneElementSchema = z.union([sourceBackedElementSchema, overlayElementSchema]);

const sceneGroupSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(128),
  type: z.string().min(1),
  elementIds: z.array(idSchema),
  transform: transform2DSchema,
  appearance: appearanceSchema,
});

const sceneBackgroundSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('color'), color: z.string().min(1) }),
  z.object({ kind: z.literal('image'), assetId: idSchema }),
]);

const sceneSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(128),
  settings: z.object({
    defaultTransitionId: idSchema.nullable(),
  }),
  background: sceneBackgroundSchema,
  elements: z.array(sceneElementSchema),
  groups: z.array(sceneGroupSchema),
  animations: z.object({
    onEnter: sceneAnimationSchema.nullable(),
    onExit: sceneAnimationSchema.nullable(),
  }),
  metadata: z.object({ notes: z.string().optional() }).optional(),
});

const audioFilterOrEffectSchema = z.object({
  id: idSchema,
  type: z.string().min(1),
  enabled: z.boolean(),
  parameters: z.record(z.string(), z.unknown()),
});

const audioChannelSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  sourceId: idSchema.nullable(),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  solo: z.boolean(),
  pan: z.number().min(-1).max(1),
  filters: z.array(audioFilterOrEffectSchema),
  effects: z.array(audioFilterOrEffectSchema),
});

const audioMixerSchema = z.object({
  master: z.object({
    volume: z.number().min(0).max(1),
    muted: z.boolean(),
  }),
  channels: z.array(audioChannelSchema),
});

const transitionBaseFields = {
  id: idSchema,
  durationMs: z.number().nonnegative(),
  easing: z.string().min(1),
};

const transitionSchema = z.discriminatedUnion('type', [
  z.object({
    ...transitionBaseFields,
    type: z.literal('cut'),
    settings: z.object({}),
  }),
  z.object({
    ...transitionBaseFields,
    type: z.literal('fade'),
    settings: z.object({
      curve: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out']).optional(),
    }),
  }),
  z.object({
    ...transitionBaseFields,
    type: z.literal('dissolve'),
    settings: z.object({
      softEdge: z.number().min(0).max(1).optional(),
    }),
  }),
  z.object({
    ...transitionBaseFields,
    type: z.literal('slide'),
    settings: z.object({
      direction: z.enum(['left', 'right', 'up', 'down']),
    }),
  }),
  z.object({
    ...transitionBaseFields,
    type: z.literal('zoom'),
    settings: z.object({
      scale: z.number().positive(),
    }),
  }),
]);

const projectSettingsSchema = z.object({
  video: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    frameRate: z.number().positive(),
    colorSpace: z.string().optional(),
  }),
  audio: z.object({
    sampleRate: z.number().positive(),
    channels: z.number().int().positive(),
  }),
  output: z.object({
    profile: z.string().optional(),
  }),
  preferences: z.object({
    defaultSceneName: z.string().optional(),
  }),
});

const persistableProjectSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(128),
  type: z.enum(['podcast', 'gaming', 'broadcast', 'general']),
  settings: projectSettingsSchema,
  scenes: z.array(sceneSchema),
  sources: z.array(sourceSchema),
  assets: z.array(assetSchema),
  audioMixer: audioMixerSchema,
  transitions: z.array(transitionSchema),
  metadata: z.object({
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    description: z.string().optional(),
  }),
});

type RefinementCtx = z.core.$RefinementCtx;

const assertUniqueIds = (ids: string[], label: string, ctx: RefinementCtx) => {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      ctx.addIssue({
        code: 'custom',
        message: `studio.validation.duplicateId:${label}:${id}`,
      });
    }
    seen.add(id);
  }
};

const assertGroupMembershipInvariant = (scene: z.infer<typeof sceneSchema>, ctx: RefinementCtx) => {
  const elementsById = new Map(scene.elements.map((el) => [el.id, el]));

  for (const group of scene.groups) {
    const memberSet = new Set(group.elementIds);
    if (memberSet.size !== group.elementIds.length) {
      ctx.addIssue({
        code: 'custom',
        message: `studio.validation.duplicateGroupMember:${group.id}`,
      });
    }

    for (const elementId of group.elementIds) {
      const element = elementsById.get(elementId);
      if (!element) {
        ctx.addIssue({
          code: 'custom',
          message: `studio.validation.missingGroupMember:${group.id}:${elementId}`,
        });
        continue;
      }
      if (element.parentGroupId !== group.id) {
        ctx.addIssue({
          code: 'custom',
          message: `studio.validation.parentGroupMismatch:${elementId}`,
        });
      }
    }

    for (const element of scene.elements) {
      if (element.parentGroupId === group.id && !memberSet.has(element.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `studio.validation.elementMissingFromGroup:${element.id}:${group.id}`,
        });
      }
    }
  }
};

export const projectFileSchema = z
  .object({
    formatVersion: z.literal(2),
    project: persistableProjectSchema,
  })
  .superRefine((file, ctx) => {
    const { project } = file;

    assertUniqueIds(
      project.scenes.map((s) => s.id),
      'scene',
      ctx,
    );
    assertUniqueIds(
      project.sources.map((s) => s.id),
      'source',
      ctx,
    );
    assertUniqueIds(
      project.assets.map((a) => a.id),
      'asset',
      ctx,
    );
    assertUniqueIds(
      project.transitions.map((t) => t.id),
      'transition',
      ctx,
    );

    const sourceIds = new Set(project.sources.map((s) => s.id));
    const assetIds = new Set(project.assets.map((a) => a.id));
    const transitionIds = new Set(project.transitions.map((t) => t.id));

    for (const scene of project.scenes) {
      assertUniqueIds(
        scene.elements.map((e) => e.id),
        `element:${scene.id}`,
        ctx,
      );
      assertUniqueIds(
        scene.groups.map((g) => g.id),
        `group:${scene.id}`,
        ctx,
      );
      assertGroupMembershipInvariant(scene, ctx);

      if (scene.settings.defaultTransitionId && !transitionIds.has(scene.settings.defaultTransitionId)) {
        ctx.addIssue({
          code: 'custom',
          message: `studio.validation.unknownTransition:${scene.settings.defaultTransitionId}`,
        });
      }

      if (scene.background.kind === 'image' && !assetIds.has(scene.background.assetId)) {
        ctx.addIssue({
          code: 'custom',
          message: `studio.validation.unknownAsset:${scene.background.assetId}`,
        });
      }

      for (const anim of [scene.animations.onEnter, scene.animations.onExit]) {
        if (anim && !assetIds.has(anim.assetId)) {
          ctx.addIssue({
            code: 'custom',
            message: `studio.validation.unknownAsset:${anim.assetId}`,
          });
        }
      }

      for (const element of scene.elements) {
        if (element.type !== 'overlay' && !sourceIds.has(element.sourceId)) {
          ctx.addIssue({
            code: 'custom',
            message: `studio.validation.unknownSource:${element.sourceId}`,
          });
        }
        if (element.type === 'overlay') {
          for (const anim of element.animations) {
            if (!assetIds.has(anim.assetId)) {
              ctx.addIssue({
                code: 'custom',
                message: `studio.validation.unknownAsset:${anim.assetId}`,
              });
            }
          }
        }

        if (
          element.type === 'image' ||
          element.type === 'video' ||
          element.type === 'camera' ||
          element.type === 'screen'
        ) {
          const maskId = element.settings.maskSourceId;
          if (maskId && !sourceIds.has(maskId)) {
            ctx.addIssue({
              code: 'custom',
              message: `studio.validation.unknownSource:${maskId}`,
            });
          }
        }

        for (const effect of element.effects) {
          if (effect.type === 'mask' && !sourceIds.has(effect.parameters.sourceId)) {
            ctx.addIssue({
              code: 'custom',
              message: `studio.validation.unknownSource:${effect.parameters.sourceId}`,
            });
          }
        }
      }
    }

    for (const source of project.sources) {
      if ((source.type === 'image' || source.type === 'video') && !assetIds.has(source.assetId)) {
        ctx.addIssue({
          code: 'custom',
          message: `studio.validation.unknownAsset:${source.assetId}`,
        });
      }
      if (source.type === 'audio' && source.assetId && !assetIds.has(source.assetId)) {
        ctx.addIssue({
          code: 'custom',
          message: `studio.validation.unknownAsset:${source.assetId}`,
        });
      }
      if (source.type === 'animation' && source.assetId && !assetIds.has(source.assetId)) {
        ctx.addIssue({
          code: 'custom',
          message: `studio.validation.unknownAsset:${source.assetId}`,
        });
      }
    }

    for (const channel of project.audioMixer.channels) {
      if (channel.sourceId && !sourceIds.has(channel.sourceId)) {
        ctx.addIssue({
          code: 'custom',
          message: `studio.validation.unknownSource:${channel.sourceId}`,
        });
      }
    }
  });

export type ProjectFileSchema = z.infer<typeof projectFileSchema>;
