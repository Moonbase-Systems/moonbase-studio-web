import type { AnimationElement } from './animation-element.domain';
import type { AudioVisualElement } from './audio-element.domain';
import type { BrowserElement } from './browser-element.domain';
import type { CameraElement } from './camera-element.domain';
import type { ImageElement } from './image-element.domain';
import type { ScreenElement } from './screen-element.domain';
import type { ShapeElement } from './shape-element.domain';
import type { TextElement } from './text-element.domain';
import type { VideoElement } from './video-element.domain';

export * from './animation-element.domain';
export * from './audio-element.domain';
export * from './browser-element.domain';
export * from './camera-element.domain';
export * from './image-element.domain';
export * from './overlay-element.domain';
export * from './scene-element-base.domain';
export * from './screen-element.domain';
export * from './shape-element.domain';
export * from './text-element.domain';
export * from './video-element.domain';
export * from './visual-element-settings.domain';

export type SourceBackedElement =
  | CameraElement
  | ScreenElement
  | ImageElement
  | VideoElement
  | TextElement
  | ShapeElement
  | BrowserElement
  | AudioVisualElement
  | AnimationElement;

export type SourceBackedElementType = SourceBackedElement['type'];
