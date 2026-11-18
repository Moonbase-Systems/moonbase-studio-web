import type { Appearance, Transform2D } from './common.domain';
import type { ChannelId, ElementId } from './ids.domain';
import type { ProjectVideoSettings } from './project.domain';
import type { SourceBackedElement, SourceBackedElementType } from './scene-elements';
import { createDefaultSettingsForSource } from './scene-elements/create-element-settings';
import type { OverlayElement } from './scene-elements/overlay-element.domain';
import { createSceneElementBaseFields } from './scene-elements/scene-element-base.domain';
import type { Source } from './source.domain';

export type {
  AnimationElement,
  AudioVisualElement,
  BrowserElement,
  CameraElement,
  ImageElement,
  OverlayContent,
  OverlayElement,
  OverlayKind,
  ScreenElement,
  ShapeElement,
  SourceBackedElement,
  SourceBackedElementType,
  TextElement,
  VideoElement,
} from './scene-elements';
export type { SceneElementBase } from './scene-elements/scene-element-base.domain';
export { createDefaultElementTransform } from './scene-elements/scene-element-base.domain';

export type SceneElement = SourceBackedElement | OverlayElement;

export type SceneElementType = SceneElement['type'];

/** Maps project source types to scene element types (`audio` → `audioVisual`). */
export const elementTypeForSource = (source: Source): SourceBackedElementType => {
  if (source.type === 'audio') {
    return 'audioVisual';
  }
  if (source.type === 'animation') {
    return 'animation';
  }
  return source.type as SourceBackedElementType;
};

export const createSourceBackedElement = (input: {
  id: ElementId;
  source: Source;
  name?: string;
  video: ProjectVideoSettings;
  transform?: Partial<Transform2D>;
  appearance?: Partial<Appearance>;
  /** Required for an audio source. The layer enables this project channel and has no strip of its own. */
  channelId?: ChannelId;
}): SourceBackedElement => {
  const base = createSceneElementBaseFields({
    id: input.id,
    name: input.name ?? input.source.name,
    video: input.video,
    transform: input.transform,
    appearance: input.appearance,
  });

  if (input.source.type === 'browser' && input.transform?.keepAspectRatio === undefined) {
    base.transform = { ...base.transform, keepAspectRatio: true };
  }

  if (input.source.type === 'audio') {
    return {
      ...base,
      type: 'audioVisual',
      channelId: input.channelId ?? input.source.id,
      settings: {},
    };
  }

  const type = elementTypeForSource(input.source);
  const settings = createDefaultSettingsForSource(input.source);

  return {
    ...base,
    type,
    sourceId: input.source.id,
    settings,
  } as SourceBackedElement;
};

export const isOverlayElement = (element: SceneElement): element is OverlayElement => element.type === 'overlay';
