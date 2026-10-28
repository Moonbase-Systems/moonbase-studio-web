import { createDefaultElementCrop } from '../models/common.domain';
import { createDefaultSettingsForSource } from '../models/scene-elements/create-element-settings';
import type { Source } from '../models/source.domain';

type JsonRecord = Record<string, unknown>;

const defaultTransformExtras = {
  anchorX: 0,
  anchorY: 0,
  flipX: false,
  flipY: false,
  keepAspectRatio: false,
};

const defaultEffectName = (type: string): string => {
  switch (type) {
    case 'chroma-key':
      return 'Chroma key';
    case 'color-correction':
      return 'Color correction';
    case 'blur':
      return 'Blur';
    case 'sharpen':
      return 'Sharpen';
    case 'mask':
      return 'Mask';
    case 'shadow':
      return 'Shadow';
    case 'outline':
      return 'Outline';
    default:
      return type;
  }
};

const migrateEffect = (raw: unknown): unknown | null => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const effect = raw as JsonRecord;
  const type = effect.type;
  if (type === 'crop') {
    return null;
  }
  if (typeof type !== 'string') {
    return null;
  }

  const parameters =
    effect.parameters && typeof effect.parameters === 'object' && !Array.isArray(effect.parameters)
      ? { ...(effect.parameters as JsonRecord) }
      : {};

  if (type === 'color-correction') {
    if (parameters.gamma === undefined) {
      parameters.gamma = 1;
    }
    if (parameters.temperature === undefined) {
      parameters.temperature = 0;
    }
  }

  return {
    id: effect.id,
    name: typeof effect.name === 'string' && effect.name.length > 0 ? effect.name : defaultEffectName(type),
    enabled: effect.enabled === true,
    type,
    parameters,
  };
};

const extractCropFromEffects = (
  effects: unknown[],
): { crop: ReturnType<typeof createDefaultElementCrop>; effects: unknown[] } => {
  const crop = createDefaultElementCrop();
  const migrated: unknown[] = [];

  for (const item of effects) {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      const effect = item as JsonRecord;
      if (effect.type === 'crop' && effect.parameters && typeof effect.parameters === 'object') {
        const p = effect.parameters as JsonRecord;
        crop.top = typeof p.top === 'number' ? p.top : crop.top;
        crop.right = typeof p.right === 'number' ? p.right : crop.right;
        crop.bottom = typeof p.bottom === 'number' ? p.bottom : crop.bottom;
        crop.left = typeof p.left === 'number' ? p.left : crop.left;
        continue;
      }
    }
    const next = migrateEffect(item);
    if (next) {
      migrated.push(next);
    }
  }

  return { crop, effects: migrated };
};

const migrateElement = (raw: unknown, sourcesById: Map<string, Source>): unknown => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }
  const element = { ...(raw as JsonRecord) };

  const transform =
    element.transform && typeof element.transform === 'object' && !Array.isArray(element.transform)
      ? { ...(element.transform as JsonRecord), ...defaultTransformExtras }
      : { ...defaultTransformExtras };
  element.transform = transform;

  const effectsRaw = Array.isArray(element.effects) ? element.effects : [];
  const { crop, effects } = extractCropFromEffects(effectsRaw);
  element.crop = element.crop ?? crop;
  element.effects = effects;

  if (element.type === 'overlay') {
    return element;
  }

  if (element.settings === undefined && typeof element.type === 'string' && typeof element.sourceId === 'string') {
    const source = sourcesById.get(element.sourceId);
    if (source) {
      element.settings = createDefaultSettingsForSource(source);
    }
  }

  return element;
};

const migrateSources = (sources: unknown[]): unknown[] => {
  return sources.map((raw) => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return raw;
    }
    const source = { ...(raw as JsonRecord) };
    if (source.type === 'camera' || source.type === 'screen') {
      if (source.settings === undefined) {
        source.settings = {};
      }
    }
    return source;
  });
};

export const migrateProjectFileV1ToV2 = (raw: unknown): unknown => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }

  const file = { ...(raw as JsonRecord) };
  if (file.formatVersion !== 1) {
    return raw;
  }

  const project =
    file.project && typeof file.project === 'object' && !Array.isArray(file.project)
      ? ({ ...(file.project as JsonRecord) } as JsonRecord)
      : null;

  if (!project) {
    file.formatVersion = 2;
    return file;
  }

  const sourcesRaw = Array.isArray(project.sources) ? (project.sources as unknown[]) : [];
  project.sources = migrateSources(sourcesRaw);

  const sourcesById = new Map<string, Source>();
  for (const item of sourcesRaw) {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      const s = item as JsonRecord;
      if (typeof s.id === 'string' && typeof s.type === 'string') {
        sourcesById.set(s.id, item as Source);
      }
    }
  }

  if (Array.isArray(project.scenes)) {
    project.scenes = project.scenes.map((scene) => {
      if (scene === null || typeof scene !== 'object' || Array.isArray(scene)) {
        return scene;
      }
      const nextScene = { ...(scene as JsonRecord) };
      if (Array.isArray(nextScene.elements)) {
        nextScene.elements = nextScene.elements.map((el) => migrateElement(el, sourcesById));
      }
      if (Array.isArray(nextScene.groups)) {
        nextScene.groups = nextScene.groups.map((group) => {
          if (group === null || typeof group !== 'object' || Array.isArray(group)) {
            return group;
          }
          const g = { ...(group as JsonRecord) };
          if (g.transform && typeof g.transform === 'object' && !Array.isArray(g.transform)) {
            g.transform = { ...(g.transform as JsonRecord), ...defaultTransformExtras };
          }
          return g;
        });
      }
      return nextScene;
    });
  }

  file.project = project;
  file.formatVersion = 2;
  return file;
};
