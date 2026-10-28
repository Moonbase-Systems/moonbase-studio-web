import { z } from 'zod';

import type { SceneElement } from '../models/scene-element.domain';
import { portErr } from '../ports/result';
import {
  audioSettingsSchema,
  cameraSettingsSchema,
  imageSettingsSchema,
  screenSettingsSchema,
  shapeSettingsSchema,
  textSettingsSchema,
  videoSettingsSchema,
} from '../schemas/scene-elements/scene-element.schema';
import type { StudioResult } from './errors';

const emptySettingsSchema = z.object({}).strict();

const settingsSchemaForElement = (element: SceneElement): z.ZodType | null => {
  if (element.type === 'overlay') {
    return null;
  }
  switch (element.type) {
    case 'image':
      return imageSettingsSchema;
    case 'video':
      return videoSettingsSchema;
    case 'camera':
      return cameraSettingsSchema;
    case 'screen':
      return screenSettingsSchema;
    case 'text':
      return textSettingsSchema;
    case 'shape':
      return shapeSettingsSchema;
    case 'audioVisual':
      return audioSettingsSchema;
    case 'browser':
    case 'animation':
      return emptySettingsSchema;
    default: {
      const exhaustive: never = element;
      return exhaustive;
    }
  }
};

export const mergeElementSettings = (element: SceneElement, partial: Record<string, unknown>): StudioResult<void> => {
  if (element.type === 'overlay') {
    return portErr({
      kind: 'invalid-argument',
      message: 'settings cannot be updated on overlay layers',
    });
  }

  const schema = settingsSchemaForElement(element);
  if (!schema) {
    return portErr({ kind: 'invalid-argument', message: 'Unsupported element type for settings' });
  }

  const merged = { ...element.settings, ...partial };
  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    return portErr({
      kind: 'invalid-argument',
      message: parsed.error.issues[0]?.message ?? 'Invalid element settings',
    });
  }

  element.settings = parsed.data as typeof element.settings;
  return { ok: true, value: undefined };
};
