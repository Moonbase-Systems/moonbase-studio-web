import type { ElementId } from '../models/ids.domain';
import type { Scene } from '../models/scene.domain';
import type { PortResult } from './result';

export type CompositionEngineError =
  | { kind: 'not-initialized' }
  | { kind: 'render-failed'; message: string }
  | { kind: 'io'; message: string };

export type CompositionViewport = {
  width: number;
  height: number;
};

/**
 * Renders a scene composition independently of the Vue UI.
 * Implementations must not leak renderer types (e.g. PixiJS) into this contract.
 */
export type CompositionEngine = {
  initialize(viewport?: CompositionViewport): Promise<PortResult<void, CompositionEngineError>>;
  render(scene: Scene): Promise<PortResult<void, CompositionEngineError>>;
  resize?(viewport: CompositionViewport): Promise<PortResult<void, CompositionEngineError>>;
  /** Faintly shows the cropped-away picture and its full outline for one element; null hides it. */
  previewCrop?(elementId: ElementId | null): void;
  dispose(): Promise<PortResult<void, CompositionEngineError>>;
};
