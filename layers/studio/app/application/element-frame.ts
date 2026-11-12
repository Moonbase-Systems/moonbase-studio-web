import type { Transform2D } from '../models/common.domain';
import type { Project } from '../models/project.domain';
import { elementTypeForSource, type SceneElement } from '../models/scene-element.domain';
import { createDefaultTextElementSettings } from '../models/scene-elements/text-element.domain';
import type { Source } from '../models/source.domain';
import { measureDynamicTextFrame } from '../playback/measure-text-frame';
import { transform2DSchema } from '../schemas/scene-elements/element-shared.schema';

export const SHAPE_FRAME_SIZE = 100;

const positiveSize = (width?: number, height?: number): { width: number; height: number } | null => {
  if (width === undefined || height === undefined || !(width > 0) || !(height > 0)) {
    return null;
  }
  return { width, height };
};

/** Pixel size stored on the source or its asset. Null when the source has no media yet. */
export const sourceContentSize = (project: Project, source: Source): { width: number; height: number } | null => {
  if (source.type === 'image' || source.type === 'animation') {
    if (!source.assetId) {
      return null;
    }
    const asset = project.assets.find((item) => item.id === source.assetId);
    return positiveSize(asset?.metadata?.width, asset?.metadata?.height);
  }

  if (source.type === 'screen') {
    return positiveSize(source.width, source.height);
  }

  return null;
};

/** Width and height for a newly created scene element. Other transform fields stay on the canvas default. */
export const creationFrame = (project: Project, source: Source): Partial<Transform2D> => {
  const type = elementTypeForSource(source);

  if (type === 'shape') {
    return { width: SHAPE_FRAME_SIZE, height: SHAPE_FRAME_SIZE };
  }

  if (type === 'text' && source.type === 'text') {
    return measureDynamicTextFrame(createDefaultTextElementSettings(source.content));
  }

  if (type === 'screen' || type === 'image' || type === 'animation') {
    return sourceContentSize(project, source) ?? { width: 0, height: 0 };
  }

  return {};
};

type FrameChanges = {
  settings?: Record<string, unknown>;
  transform?: Partial<Transform2D>;
  sourceId?: string;
};

const assignFrame = (element: SceneElement, width: number, height: number): void => {
  const parsed = transform2DSchema.safeParse({ ...element.transform, width, height });
  if (parsed.success) {
    element.transform = parsed.data;
  }
};

/**
 * Keeps dynamic text hugging its content, and copies a screen, image or animation frame from the source
 * when that source is chosen.
 */
export const applyElementFrameRules = (project: Project, element: SceneElement, changes: FrameChanges): void => {
  if (element.type === 'text') {
    const sizedByHand = changes.transform?.width !== undefined || changes.transform?.height !== undefined;
    if (sizedByHand) {
      element.settings = { ...element.settings, sizing: 'fixed' };
    } else if (element.settings.sizing === 'dynamic' && changes.settings) {
      const frame = measureDynamicTextFrame(element.settings);
      assignFrame(element, frame.width, frame.height);
    }
  }

  if (changes.sourceId === undefined) {
    return;
  }
  if (element.type !== 'screen' && element.type !== 'image' && element.type !== 'animation') {
    return;
  }

  const source = project.sources.find((item) => item.id === element.sourceId);
  if (!source) {
    return;
  }

  const frame = sourceContentSize(project, source);
  if (frame) {
    assignFrame(element, frame.width, frame.height);
  }
};
