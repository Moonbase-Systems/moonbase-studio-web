// Production CSP (nuxt-security) forbids 'unsafe-eval'; this swaps Pixi's generated shader/uniform code for static versions.
import 'pixi.js/unsafe-eval';

import {
  Application,
  type BLEND_MODES,
  BlurFilter,
  CanvasTextMetrics,
  Container,
  FillGradient,
  type FillInput,
  Graphics,
  ImageSource,
  Rectangle,
  RenderTexture,
  Sprite,
  Text,
  type TextDropShadow,
  TextStyle,
  Texture,
  Ticker,
} from 'pixi.js';

import type { Appearance, BlendMode, ElementCrop, Transform2D } from '../../models/common.domain';
import { effectPlayback } from '../../models/effects';
import type { AssetId, ElementId, GroupId, SceneId, SourceId } from '../../models/ids.domain';
import type { Scene, SceneBackground } from '../../models/scene.domain';
import type {
  ImageElement,
  SceneElement,
  ScreenElement,
  ShapeElement,
  TextElement,
} from '../../models/scene-element.domain';
import type { SceneGroup } from '../../models/scene-group.domain';
import type {
  CompositionEngine,
  CompositionEngineError,
  CompositionViewport,
  FrameDelivery,
} from '../../ports/composition-engine';
import { portErr, portOk, type PortResult } from '../../ports/result';
import { sizeOutputCanvas } from '../output/output-surface';
import {
  alignTextBlock,
  cropFrame,
  fitContentRect,
  isValidSize,
  letterboxComposition,
  linearGradientPoints,
  placementForTransform,
  type Rect,
  type Size,
  toFontWeight,
} from './composition-geometry';
import { BROWSER_PLATE_CAPTION, layerDrawKind, overlayText } from './composition-layer';
import { elementContentKey, planSceneSync } from './composition-scene-sync';
import { createPixiTextureCache, type PixiTextureCache, type TextureScaleMode } from './pixi-texture-cache';
import { type FadeCurve, fadeProgress, transitionPlayer } from './transition-playback';

export type PixiCompositionEngineOptions = {
  getHost: () => HTMLElement | null;
  /** Project frame in document pixels (e.g. 1920×1080); the canvas letterboxes it. */
  getCompositionSize: () => Size;
  /** Scenes whose containers survive switching; others are destroyed on the next render. */
  getRetainedSceneIds: () => readonly SceneId[];
  resolveSourceAssetId: (sourceId: SourceId) => AssetId | null;
  resolveAssetUrl: (assetId: AssetId) => string | null;
  /** Live display capture for a screen source, when the user has picked one. */
  resolveScreenStream: (sourceId: SourceId) => MediaStream | null;
  /** Shown when a saved screen capture was not restored. */
  missingScreenCaption?: (sourceId: SourceId) => string;
  /** Highest rate the preview redraws captures at; null or omitted redraws on every new capture frame. */
  getCapturePreviewFrameRate?: () => number | null;
  /** Fill inside the project frame when the scene has no background; preview-only by default. */
  compositionFillWhenBackgroundNone?: number;
  /** Capture size when its first frame shows and whenever the captured window changes size afterwards. */
  onCapturePicture?: (sourceId: SourceId, picture: Size, change: 'shown' | 'resized') => void;
  /** Live camera already opened for the editor. Recording must not call getUserMedia again. */
  resolveCameraStream?: (sourceId: SourceId) => MediaStream | null;
  /** Video file or animation asset. `image` is a still or GIF; `video` is one shared HTMLVideoElement. */
  resolveVideoFile?: (sourceId: SourceId) => { url: string | null; mediaKind: 'image' | 'video'; loop: boolean } | null;
  /** Program-mix spectrum from the existing AudioContext. Missing data leaves the bars at rest. */
  readProgramSpectrum?: (bins: Uint8Array) => boolean;
  /** Transition that plays when this scene becomes active. Null cuts. */
  resolveSceneTransition?: (sceneId: SceneId) => { type: string; durationMs: number; curve?: FadeCurve } | null;
  /** Non-fatal problems: failed texture loads, broken references inside a scene. */
  onDiagnostic?: (error: CompositionEngineError) => void;
};

type EngineResult = PortResult<void, CompositionEngineError>;

type ImageBinding = {
  url: string;
  scaleMode: TextureScaleMode;
  view: Texture | null;
};

type CaptureBinding = {
  sourceId: SourceId;
  stream: MediaStream;
  element: HTMLVideoElement;
  texture: Texture | null;
  /** Re-fits the sprite when the capture changes resolution. */
  fit: ((width: number, height: number) => void) | null;
  width: number;
  height: number;
  /** Pending `requestVideoFrameCallback` handle; null where the browser lacks it and frames are polled. */
  frameCallback: number | null;
  /** Next slot on the capped preview's frame grid; ignored while the preview is uncapped. */
  nextDrawAt: number;
  /** Paused on purpose because its scene is off screen. */
  suspended: boolean;
  /** When the element last reported a new frame, uploaded or not. */
  lastCallbackAt: number;
  /** Last `presentedFrames` from `requestVideoFrameCallback`; advances only when the browser paints a new frame. */
  lastPresentedFrames: number;
  /** When `srcObject` was last set again to unstick the element. */
  reattachedAt: number;
  /**
   * Until this time, muted frames are still uploaded. After a minimised window returns Chrome can leave
   * `track.muted` true while already delivering a real picture; skipping those would keep the freeze.
   */
  forcePresentUntil: number;
  /** Last capture-surface size from `track.getSettings()`; a jump up from a stub means the window returned. */
  lastSurfaceWidth: number;
  lastSurfaceHeight: number;
  /** Removes the listeners and timer that bring the capture back after it stalls. */
  stopWatching: (() => void) | null;
  /** Screen capture owns its element. Camera and file video share one element per source. */
  ownsElement: boolean;
  /** Drops one user of a shared element. Null for an exclusive capture. */
  releaseShared: (() => void) | null;
};

type ContentLayout = Size & { crop: ElementCrop };

const sameLayout = (a: ContentLayout | null, b: ContentLayout): boolean =>
  a !== null &&
  a.width === b.width &&
  a.height === b.height &&
  a.crop.left === b.crop.left &&
  a.crop.right === b.crop.right &&
  a.crop.top === b.crop.top &&
  a.crop.bottom === b.crop.bottom;

type ContentHolder = {
  content: Container;
  contentKey: string | null;
  /** Box and crop the content was last laid out for. */
  contentLayout: ContentLayout | null;
  /** Fits loaded media to a new box and crop in place; null while content must be rebuilt for them. */
  relayout: ((layout: ContentLayout) => void) | null;
  /** The whole uncropped picture, shown faintly while its crop is being dragged. */
  cropGhost: Container | null;
  image: ImageBinding | null;
  capture: CaptureBinding | null;
  /** Level bars for an audio-visual layer. */
  bars: Graphics | null;
  /**
   * Browser stand-in for the output copy. Hidden on the preview so a transparent
   * page shows the layers underneath instead of this plate.
   */
  plate: Container | null;
  /** Sprite used as an alpha mask. */
  maskSprite: Sprite | null;
  disposables: { destroy(): void }[];
};

type TransformNode = {
  /** Placement, opacity, visibility, blend mode. */
  root: Container;
  /** Mirrors around the box centre so flipping does not move the box. */
  flip: Container;
};

type ElementNode = TransformNode & ContentHolder & { id: ElementId };
type GroupNode = TransformNode & { id: GroupId };

type SceneState = {
  container: Container;
  background: ContentHolder;
  elements: Map<ElementId, ElementNode>;
  groups: Map<GroupId, GroupNode>;
  reportedIssues: Set<string>;
};

type FadePlayback = {
  fromId: SceneId;
  toId: SceneId;
  startedAt: number;
  durationMs: number;
  curve: FadeCurve;
};

type Runtime = {
  app: Application;
  frame: Container;
  frameMask: Graphics;
  /** Screen-space edge of the project frame, so the placeable area stays visible. */
  projectOutline: Graphics;
  scenes: Map<SceneId, SceneState>;
  textures: PixiTextureCache;
  composition: Size;
  viewport: Size;
  frameRequest: number | null;
  stopIdleTimers: () => void;
  /** Profile-sized canvas. It is not mounted in the editor layout. */
  outputCanvas: HTMLCanvasElement;
  outputContext: CanvasRenderingContext2D | null;
  outputTexture: RenderTexture | null;
  outputCaptureActive: boolean;
  deliveredFrames: number;
  firstDeliveredAt: number | null;
  lastDeliveredAt: number | null;
  activeSceneId: SceneId | null;
  fade: FadePlayback | null;
  reportedTransitions: Set<string>;
};

const DESTROY_OWNED = { children: true, context: true, style: true } as const;
const PROJECT_OUTLINE = 0xffffff;
const PLACEHOLDER_FILL = 0x1f2937;
const PLACEHOLDER_STROKE = 0x64748b;
const PLACEHOLDER_TEXT = '#cbd5e1';

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const toBlendMode = (blendMode: BlendMode | undefined): BLEND_MODES => blendMode ?? 'inherit';

const SCHEDULER_INTERVAL_MS = 1000;

/**
 * Pixi keeps `Ticker.system` requesting an animation frame at the display refresh rate for two
 * listeners the preview has no use for at that pace: pointer hit-testing and the GPU garbage-collection
 * scheduler. Detaching them lets an unchanged scene stay idle; the scheduler's tasks run every few
 * tens of seconds, so a one-second timer keeps them on time.
 */
const quietSystemTicker = (app: Application): (() => void) => {
  app.renderer.events.setTargetElement(null as unknown as HTMLElement);

  const scheduler = app.renderer.scheduler as unknown as { _update?: () => void };
  const update = scheduler._update;
  if (typeof update !== 'function') {
    return () => undefined;
  }
  Ticker.system.remove(update, scheduler);
  const timer = window.setInterval(() => update.call(scheduler), SCHEDULER_INTERVAL_MS);
  return () => window.clearInterval(timer);
};

const applyPlacement = (node: TransformNode, transform: Transform2D, appearance: Appearance, visible: boolean) => {
  const placement = placementForTransform(transform);
  node.root.position.set(placement.x, placement.y);
  node.root.pivot.set(placement.pivotX, placement.pivotY);
  node.root.scale.set(placement.scaleX, placement.scaleY);
  node.root.rotation = placement.rotation;
  node.root.alpha = appearance.opacity;
  node.root.visible = visible;
  node.root.blendMode = toBlendMode(appearance.blendMode);

  const centreX = transform.width / 2;
  const centreY = transform.height / 2;
  node.flip.position.set(centreX, centreY);
  node.flip.pivot.set(centreX, centreY);
  node.flip.scale.set(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
};

const createTransformNode = (): TransformNode => {
  const root = new Container();
  const flip = new Container();
  root.addChild(flip);
  return { root, flip };
};

const createContentHolder = (): ContentHolder => ({
  content: new Container(),
  contentKey: null,
  contentLayout: null,
  relayout: null,
  cropGhost: null,
  image: null,
  capture: null,
  bars: null,
  plate: null,
  maskSprite: null,
  disposables: [],
});

/** Reorders `parent` to exactly `children`, moving nodes between parents when needed. */
const placeChildren = (parent: Container, children: Container[]): void => {
  children.forEach((child, index) => {
    if (parent.children[index] !== child) {
      parent.addChildAt(child, index);
    }
  });
  while (parent.children.length > children.length) {
    parent.removeChildAt(children.length);
  }
};

const displayResolution = (): number => window.devicePixelRatio || 1;

const supportsVideoFrameCallback = (video: HTMLVideoElement): boolean =>
  typeof video.requestVideoFrameCallback === 'function';

const drawPlaceholder = (parent: Container, size: Size, title: string, caption: string): void => {
  const box = new Graphics()
    .rect(0, 0, size.width, size.height)
    .fill(PLACEHOLDER_FILL)
    .stroke({ width: 2, color: PLACEHOLDER_STROKE });
  const label = new Text({
    text: `${title}\n${caption}`,
    style: {
      fill: PLACEHOLDER_TEXT,
      fontFamily: 'Roboto',
      fontSize: Math.min(48, Math.max(12, Math.min(size.width, size.height) / 8)),
      align: 'center',
      wordWrap: true,
      wordWrapWidth: Math.max(1, size.width - 16),
      breakWords: true,
    },
  });
  label.anchor.set(0.5);
  label.position.set(size.width / 2, size.height / 2);
  parent.addChild(box, label);
};

const BAR_COUNT = 16;

const paintBars = (graphics: Graphics, size: Size, samples: Uint8Array | null): void => {
  graphics.clear();
  if (size.width <= 0 || size.height <= 0) {
    return;
  }
  graphics.rect(0, 0, size.width, size.height).fill(PLACEHOLDER_FILL);
  const gap = Math.max(2, size.width * 0.01);
  const barWidth = (size.width - gap * (BAR_COUNT + 1)) / BAR_COUNT;
  for (let index = 0; index < BAR_COUNT; index += 1) {
    const sample = samples ? (samples[Math.floor((index / BAR_COUNT) * samples.length)] ?? 0) / 255 : 0.08;
    const barHeight = Math.max(2, size.height * Math.max(0.08, sample));
    graphics
      .rect(gap + index * (barWidth + gap), size.height - barHeight, Math.max(1, barWidth), barHeight)
      .fill(0x22ff86);
  }
};

const drawClipShape = (mask: Graphics, size: Size, radius: number): void => {
  mask.clear();
  if (radius > 0) {
    mask.roundRect(0, 0, size.width, size.height, Math.min(radius, size.width / 2, size.height / 2));
  } else {
    mask.rect(0, 0, size.width, size.height);
  }
  mask.fill(0xffffff);
};

const clipTo = (parent: Container, target: Container, size: Size, radius: number): Graphics => {
  const mask = new Graphics();
  drawClipShape(mask, size, radius);
  parent.addChild(mask);
  target.mask = mask;
  return mask;
};

const CROP_GHOST_ALPHA = 0.35;
const CROP_OUTLINE = 0x22ff86;

type CropGhost = { container: Container; sprite: Sprite; outline: Graphics; texture: Texture };

/** Sits behind the cropped sprite in `holder.content`, outside its mask, hidden until a crop drag starts. */
const createCropGhost = (holder: ContentHolder, source: Texture['source'], visible: boolean): CropGhost => {
  const texture = new Texture({ source, frame: new Rectangle(0, 0, source.width, source.height), dynamic: true });
  const sprite = new Sprite(texture);
  sprite.alpha = CROP_GHOST_ALPHA;
  const outline = new Graphics();
  const container = new Container();
  container.addChild(sprite, outline);
  container.visible = visible;
  holder.content.addChildAt(container, 0);
  holder.cropGhost = container;
  holder.disposables.push({ destroy: () => texture.destroy(false) });
  return { container, sprite, outline, texture };
};

/** Lays the whole picture out around its cropped part, which shows `frame` of the source at `rect`. */
const fitCropGhost = (ghost: CropGhost, source: Size, frame: Rect, rect: Rect): void => {
  const scaleX = rect.width / frame.width;
  const scaleY = rect.height / frame.height;
  const whole = {
    x: rect.x - frame.x * scaleX,
    y: rect.y - frame.y * scaleY,
    width: source.width * scaleX,
    height: source.height * scaleY,
  };
  ghost.texture.frame.copyFrom(new Rectangle(0, 0, source.width, source.height));
  ghost.texture.update();
  ghost.sprite.position.set(whole.x, whole.y);
  ghost.sprite.setSize(whole.width, whole.height);
  ghost.outline
    .clear()
    .rect(whole.x, whole.y, whole.width, whole.height)
    .stroke({ color: CROP_OUTLINE, width: 1, pixelLine: true });
};

/** PixiJS 8 skews angled linear gradients in `local` texture space, so endpoints are given in shape pixels. */
const linearShapeGradient = (
  angle: number,
  size: Size,
  colorStops: { offset: number; color: string }[],
): FillGradient => {
  const { start, end } = linearGradientPoints(angle);
  return new FillGradient({
    type: 'linear',
    start: { x: start.x * size.width, y: start.y * size.height },
    end: { x: end.x * size.width, y: end.y * size.height },
    colorStops,
    textureSpace: 'global',
  });
};

const shapeFill = (holder: ContentHolder, element: ShapeElement): FillInput | null => {
  const { settings } = element;
  if (settings.gradient && settings.gradient.stops.length > 0) {
    const colorStops = [...settings.gradient.stops]
      .sort((left, right) => left.offset - right.offset)
      .map((stop) => ({ offset: Math.min(Math.max(stop.offset, 0), 1), color: stop.color }));
    const gradient =
      settings.gradient.type === 'radial'
        ? new FillGradient({
            type: 'radial',
            center: { x: 0.5, y: 0.5 },
            innerRadius: 0,
            outerCenter: { x: 0.5, y: 0.5 },
            outerRadius: 0.5,
            colorStops,
            textureSpace: 'local',
          })
        : linearShapeGradient(settings.gradient.angle, element.transform, colorStops);
    holder.disposables.push(gradient);
    return { fill: gradient, alpha: settings.fillOpacity };
  }
  if (settings.fillColor) {
    return { color: settings.fillColor, alpha: settings.fillOpacity };
  }
  return null;
};

const drawShape = (holder: ContentHolder, element: ShapeElement): void => {
  const { width, height } = element.transform;
  const { settings } = element;
  const graphics = new Graphics();

  if (settings.shapeType === 'ellipse') {
    graphics.ellipse(width / 2, height / 2, width / 2, height / 2);
  } else if (settings.shapeType === 'triangle') {
    graphics.poly([width / 2, 0, width, height, 0, height]);
  } else if (settings.cornerRadius > 0) {
    graphics.roundRect(0, 0, width, height, Math.min(settings.cornerRadius, width / 2, height / 2));
  } else {
    graphics.rect(0, 0, width, height);
  }

  const fill = shapeFill(holder, element);
  if (fill) {
    graphics.fill(fill);
  }
  if (settings.strokeColor && settings.strokeWidth > 0) {
    graphics.stroke({ width: settings.strokeWidth, color: settings.strokeColor });
  }
  holder.content.addChild(graphics);
};

const textShadow = (element: TextElement): Partial<TextDropShadow> | false => {
  const { shadow } = element.settings;
  if (!shadow) {
    return false;
  }
  return {
    color: shadow.color,
    alpha: shadow.opacity,
    blur: shadow.blur,
    distance: Math.hypot(shadow.offsetX, shadow.offsetY),
    angle: Math.atan2(shadow.offsetY, shadow.offsetX),
  };
};

const drawText = (holder: ContentHolder, element: TextElement): void => {
  const { settings } = element;
  const box = { width: element.transform.width, height: element.transform.height };
  const lineHeight = settings.fontSize * settings.lineHeight;

  if (settings.backgroundColor) {
    holder.content.addChild(
      new Graphics()
        .rect(0, 0, box.width, box.height)
        .fill({ color: settings.backgroundColor, alpha: settings.backgroundOpacity }),
    );
  }

  const style = new TextStyle({
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    fontWeight: toFontWeight(settings.fontWeight),
    fontStyle: settings.fontStyle,
    fill: settings.color,
    align: settings.textAlign,
    lineHeight,
    letterSpacing: settings.letterSpacing,
    wordWrap: settings.wrap,
    wordWrapWidth: Math.max(1, box.width - settings.padding * 2),
    breakWords: settings.wrap,
    stroke:
      settings.strokeColor && settings.strokeWidth > 0
        ? { color: settings.strokeColor, width: settings.strokeWidth }
        : undefined,
    dropShadow: textShadow(element),
    padding: settings.shadow
      ? Math.ceil(settings.shadow.blur + Math.hypot(settings.shadow.offsetX, settings.shadow.offsetY))
      : 0,
  });

  const fittingLines =
    settings.overflow === 'visible'
      ? Number.POSITIVE_INFINITY
      : Math.max(1, Math.floor((box.height - settings.padding * 2) / lineHeight));
  const lineLimit = Math.min(settings.maxLines ?? Number.POSITIVE_INFINITY, fittingLines);
  const measured = CanvasTextMetrics.measureText(settings.text, style);
  let lines = measured.lines;
  if (lines.length > lineLimit) {
    lines = lines.slice(0, lineLimit);
    if (settings.overflow === 'ellipsis') {
      lines[lines.length - 1] = `${(lines[lines.length - 1] ?? '').trimEnd()}…`;
    }
  }
  const content = lines.join('\n');
  const metrics = content === settings.text ? measured : CanvasTextMetrics.measureText(content, style);

  const block = new Container();
  const text = new Text({ text: content, style });
  block.addChild(text);

  if (settings.underline || settings.strikethrough) {
    const decoration = new Graphics();
    const thickness = Math.max(1, settings.fontSize / 15);
    metrics.lineWidths.forEach((lineWidth, index) => {
      const offsetX =
        settings.textAlign === 'center'
          ? (metrics.width - lineWidth) / 2
          : settings.textAlign === 'right'
            ? metrics.width - lineWidth
            : 0;
      const top = index * metrics.lineHeight;
      if (settings.underline) {
        decoration.rect(offsetX, top + metrics.fontProperties.ascent + thickness, lineWidth, thickness);
      }
      if (settings.strikethrough) {
        decoration.rect(offsetX, top + metrics.fontProperties.ascent * 0.65, lineWidth, thickness);
      }
    });
    decoration.fill(settings.color);
    block.addChild(decoration);
  }

  const position = alignTextBlock(
    settings.textAlign,
    settings.verticalAlign,
    box,
    { width: metrics.width, height: metrics.height },
    settings.padding,
  );
  block.position.set(position.x, position.y);
  holder.content.addChild(block);

  if (settings.overflow !== 'visible') {
    clipTo(holder.content, block, box, 0);
  }
};

export const createPixiCompositionEngine = (options: PixiCompositionEngineOptions): CompositionEngine => {
  let runtime: Runtime | null = null;
  let lifecycle: Promise<unknown> = Promise.resolve();
  let cropPreviewId: ElementId | null = null;

  /** initialize and dispose never interleave, so a remount cannot race a teardown. */
  const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
    const next = lifecycle.then(operation);
    lifecycle = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const report = (error: CompositionEngineError): void => {
    options.onDiagnostic?.(error);
  };

  const spectrum = new Uint8Array(64);
  const sharedVideos = new Map<string, { element: HTMLVideoElement; users: number }>();
  const maskKeys = new WeakMap<ContentHolder, string>();

  const retainSharedVideo = (key: string, setup: (video: HTMLVideoElement) => void): (() => void) => {
    let entry = sharedVideos.get(key);
    if (!entry) {
      const element = document.createElement('video');
      element.muted = true;
      element.playsInline = true;
      setup(element);
      entry = { element, users: 0 };
      sharedVideos.set(key, entry);
    }
    entry.users += 1;
    const current = entry;
    return () => {
      current.users -= 1;
      if (current.users > 0) {
        return;
      }
      current.element.pause();
      current.element.srcObject = null;
      current.element.removeAttribute('src');
      current.element.load();
      sharedVideos.delete(key);
    };
  };

  const hideCropGhosts = (rt: Runtime): Container[] => {
    const hidden: Container[] = [];
    for (const scene of rt.scenes.values()) {
      for (const node of scene.elements.values()) {
        if (node.cropGhost?.visible) {
          node.cropGhost.visible = false;
          hidden.push(node.cropGhost);
        }
      }
    }
    return hidden;
  };

  const ensureOutputTarget = (rt: Runtime): void => {
    sizeOutputCanvas(rt.outputCanvas, rt.composition);
    const width = rt.outputCanvas.width;
    const height = rt.outputCanvas.height;
    if (rt.outputTexture && rt.outputTexture.width === width && rt.outputTexture.height === height) {
      return;
    }
    rt.outputTexture?.destroy(true);
    rt.outputTexture = RenderTexture.create({ width, height, resolution: 1 });
  };

  const showBrowserPlates = (rt: Runtime): Container[] => {
    const plates: Container[] = [];
    for (const scene of rt.scenes.values()) {
      for (const node of scene.elements.values()) {
        if (!node.plate) {
          continue;
        }
        node.plate.visible = true;
        plates.push(node.plate);
      }
    }
    return plates;
  };

  const publishOutput = (rt: Runtime): void => {
    ensureOutputTarget(rt);
    if (!rt.outputTexture || !rt.outputContext) {
      return;
    }
    const frame = rt.frame;
    const x = frame.position.x;
    const y = frame.position.y;
    const scaleX = frame.scale.x;
    const scaleY = frame.scale.y;
    const hidden = hideCropGhosts(rt);
    const plates = showBrowserPlates(rt);
    frame.position.set(0, 0);
    frame.scale.set(1, 1);
    try {
      rt.app.renderer.render({ container: frame, target: rt.outputTexture, clear: true });
      const extracted = rt.app.renderer.extract.canvas({ target: rt.outputTexture });
      rt.outputContext.clearRect(0, 0, rt.outputCanvas.width, rt.outputCanvas.height);
      rt.outputContext.drawImage(extracted as CanvasImageSource, 0, 0, rt.outputCanvas.width, rt.outputCanvas.height);
      const now = performance.now();
      if (rt.deliveredFrames === 0) {
        rt.firstDeliveredAt = now;
      }
      rt.deliveredFrames += 1;
      rt.lastDeliveredAt = now;
    } catch (error) {
      report({ kind: 'render-failed', message: `Output frame copy failed: ${errorMessage(error)}` });
    } finally {
      frame.position.set(x, y);
      frame.scale.set(scaleX, scaleY);
      for (const ghost of hidden) {
        ghost.visible = true;
      }
      for (const plate of plates) {
        plate.visible = false;
      }
    }
  };

  const paintAudioBars = (rt: Runtime): void => {
    let any = false;
    for (const scene of rt.scenes.values()) {
      if (!scene.container.visible && rt.fade === null) {
        continue;
      }
      for (const node of scene.elements.values()) {
        if (!node.bars) {
          continue;
        }
        any = true;
        const width = node.contentLayout?.width ?? 0;
        const height = node.contentLayout?.height ?? 0;
        const filled = options.readProgramSpectrum?.(spectrum) ?? false;
        paintBars(node.bars, { width, height }, filled ? spectrum : null);
      }
    }
    if (any && !rt.outputCaptureActive && rt.fade === null) {
      // Bars keep moving in the preview. The caller decides whether to schedule another frame.
    }
  };

  const hasAudioBars = (rt: Runtime): boolean => {
    for (const scene of rt.scenes.values()) {
      if (!scene.container.visible) {
        continue;
      }
      for (const node of scene.elements.values()) {
        if (node.bars) {
          return true;
        }
      }
    }
    return false;
  };

  const advanceFade = (rt: Runtime): void => {
    const fade = rt.fade;
    if (!fade) {
      return;
    }
    const progress = fadeProgress(performance.now() - fade.startedAt, fade.durationMs, fade.curve);
    const from = rt.scenes.get(fade.fromId);
    const to = rt.scenes.get(fade.toId);
    if (from) {
      from.container.alpha = 1 - progress;
      from.container.visible = true;
    }
    if (to) {
      to.container.alpha = progress;
      to.container.visible = true;
    }
    if (progress >= 1) {
      if (from && fade.fromId !== fade.toId) {
        from.container.visible = false;
        from.container.alpha = 1;
      }
      if (to) {
        to.container.alpha = 1;
      }
      rt.fade = null;
    }
  };

  const renderNow = (rt: Runtime): void => {
    if (rt.frameRequest !== null) {
      cancelAnimationFrame(rt.frameRequest);
      rt.frameRequest = null;
    }
    paintAudioBars(rt);
    advanceFade(rt);
    rt.app.render();
    if (rt.outputCaptureActive) {
      publishOutput(rt);
    }
    if (rt.outputCaptureActive || rt.fade || hasAudioBars(rt)) {
      requestFrame(rt);
    }
  };

  const requestFrame = (rt: Runtime): void => {
    if (rt.frameRequest !== null) {
      return;
    }
    rt.frameRequest = requestAnimationFrame(() => {
      rt.frameRequest = null;
      if (runtime !== rt) {
        return;
      }
      const polling = pollCaptureFrames(rt, performance.now());
      paintAudioBars(rt);
      advanceFade(rt);
      rt.app.render();
      if (rt.outputCaptureActive) {
        publishOutput(rt);
      }
      if (polling || rt.outputCaptureActive || rt.fade || hasAudioBars(rt)) {
        requestFrame(rt);
      }
    });
  };

  /** A minimised window reports 0×0 or a 1×1 black frame; that is not a picture to upload. */
  const MIN_CAPTURE_PICTURE = 16;

  const captureTracks = (stream: MediaStream): MediaStreamTrack[] => stream.getVideoTracks();

  /** True while Chrome has muted the capture (typically a minimised window). */
  const captureIsMuted = (stream: MediaStream): boolean =>
    captureTracks(stream).some((track) => track.readyState === 'live' && track.muted);

  /** Real pixels worth uploading: larger than a stub, and not a muted minimise freeze. */
  const captureHasPicture = (binding: CaptureBinding): boolean => {
    const { element: video, stream } = binding;
    const tracks = captureTracks(stream);
    if (tracks.length > 0) {
      if (tracks.every((track) => track.readyState === 'ended')) {
        return false;
      }
      if (captureIsMuted(stream) && performance.now() > binding.forcePresentUntil) {
        return false;
      }
    }
    const minimum = tracks.length > 0 ? MIN_CAPTURE_PICTURE : 1;
    return video.videoWidth >= minimum && video.videoHeight >= minimum;
  };

  /**
   * Uploads the capture's current frame unless the preview frame rate cap says to skip it.
   * A muted or tiny frame is ignored, so the last good picture stays up while the window is minimised.
   */
  const presentCaptureFrame = (binding: CaptureBinding, now: number): boolean => {
    if (!binding.texture || binding.element.readyState < 2 || !captureHasPicture(binding)) {
      return false;
    }
    const cap = options.getCapturePreviewFrameRate?.() ?? null;
    if (cap !== null && cap > 0) {
      const interval = 1000 / cap;
      // Frames that arrive slightly early still take their slot, so a source running at the cap
      // keeps its rate despite timing jitter.
      if (now < binding.nextDrawAt - interval * 0.25) {
        return false;
      }
      const slot = binding.nextDrawAt < now - interval ? now : binding.nextDrawAt;
      binding.nextDrawAt = slot + interval;
    }
    const source = binding.texture.source;
    source.update();
    const { videoWidth, videoHeight } = binding.element;
    if (videoWidth !== binding.width || videoHeight !== binding.height) {
      binding.width = videoWidth;
      binding.height = videoHeight;
      binding.fit?.(videoWidth, videoHeight);
      // A size change makes `source.update` resize and return before uploading; upload the new frame now.
      source.update();
      options.onCapturePicture?.(binding.sourceId, { width: videoWidth, height: videoHeight }, 'resized');
    }
    return true;
  };

  const watchCaptureFrames = (rt: Runtime, binding: CaptureBinding): void => {
    const video = binding.element;
    if (!supportsVideoFrameCallback(video) || binding.frameCallback !== null) {
      return;
    }
    binding.frameCallback = video.requestVideoFrameCallback((now, metadata) => {
      binding.frameCallback = null;
      binding.lastCallbackAt = now;
      const presented = metadata?.presentedFrames;
      const isNewFrame = typeof presented !== 'number' || presented !== binding.lastPresentedFrames;
      if (typeof presented === 'number') {
        binding.lastPresentedFrames = presented;
      }
      if (runtime !== rt || !binding.texture || binding.suspended) {
        return;
      }
      // Only upload when the browser reports a new frame (or metadata is missing). Re-uploading a
      // frozen minimise frame every callback would hide the fact that capture has stopped.
      if (isNewFrame && presentCaptureFrame(binding, now)) {
        requestFrame(rt);
      }
      watchCaptureFrames(rt, binding);
    });
  };

  /** Fallback for browsers without `requestVideoFrameCallback`: reports whether a visible capture is still playing. */
  const pollCaptureFrames = (rt: Runtime, now: number): boolean => {
    let polling = false;
    for (const state of rt.scenes.values()) {
      if (!state.container.visible) {
        continue;
      }
      for (const node of state.elements.values()) {
        const binding = node.capture;
        if (!binding?.texture || supportsVideoFrameCallback(binding.element)) {
          continue;
        }
        presentCaptureFrame(binding, now);
        if (!binding.element.paused && !binding.element.ended) {
          polling = true;
        }
      }
    }
    return polling;
  };

  const pauseSceneCaptures = (state: SceneState): void => {
    for (const node of state.elements.values()) {
      if (node.capture?.ownsElement) {
        node.capture.suspended = true;
        node.capture.element.pause();
      }
    }
  };

  const resumeSceneCaptures = (state: SceneState): void => {
    for (const node of state.elements.values()) {
      const binding = node.capture;
      if (binding) {
        binding.suspended = false;
      }
      if (binding?.ownsElement && binding.texture && binding.element.paused && !binding.element.ended) {
        void binding.element.play().catch(() => undefined);
      }
    }
  };

  const CAPTURE_WATCHDOG_MS = 500;
  /** Re-attaching restarts the decoder; throttle so a waking capture is not interrupted every tick. */
  const CAPTURE_REATTACH_MS = 1500;
  /** How long after a reattach muted frames are still accepted (stuck `muted` after restore). */
  const CAPTURE_FORCE_PRESENT_MS = 5000;

  /**
   * Nudges Chromium's Windows Graphics Capture path. A display track can sit in 0 Hz after a minimise;
   * renegotiating an ideal frame rate often makes frames flow again once the window paints.
   */
  const kickCaptureTrack = (stream: MediaStream): void => {
    for (const track of captureTracks(stream)) {
      if (track.readyState !== 'live') {
        continue;
      }
      void track.applyConstraints({ frameRate: { ideal: 30, max: 60 } }).catch(() => undefined);
    }
  };

  /**
   * Brings a capture back after its window was minimised. Re-attaches `srcObject`, nudges constraints,
   * restarts playback and re-arms the frame callback. Do not call this on a mere frame stall: with WGC
   * 0 Hz a static window produces no frames while healthy, and re-attaching then can break the track.
   */
  const reviveCapture = (rt: Runtime, binding: CaptureBinding): void => {
    if (runtime !== rt || !binding.texture || binding.suspended) {
      return;
    }
    const { element: video, stream } = binding;
    if (!captureTracks(stream).some((track) => track.readyState === 'live')) {
      return;
    }
    if (binding.frameCallback !== null) {
      video.cancelVideoFrameCallback(binding.frameCallback);
      binding.frameCallback = null;
    }
    const now = performance.now();
    if (now - binding.reattachedAt >= CAPTURE_REATTACH_MS) {
      binding.reattachedAt = now;
      binding.forcePresentUntil = now + CAPTURE_FORCE_PRESENT_MS;
      // Keep the stream on the binding: `video.srcObject` is null for a moment during reattach.
      video.srcObject = null;
      video.srcObject = stream;
      kickCaptureTrack(stream);
    } else if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    if (video.paused) {
      void video.play().catch(() => undefined);
    }
    binding.nextDrawAt = Number.NEGATIVE_INFINITY;
    if (presentCaptureFrame(binding, now)) {
      requestFrame(rt);
    }
    watchCaptureFrames(rt, binding);
  };

  const readCaptureSurface = (stream: MediaStream): { width: number; height: number } => {
    for (const track of captureTracks(stream)) {
      if (track.readyState !== 'live') {
        continue;
      }
      const { width = 0, height = 0 } = track.getSettings();
      if (width > 0 || height > 0) {
        return { width, height };
      }
    }
    return { width: 0, height: 0 };
  };

  const watchCaptureHealth = (rt: Runtime, binding: CaptureBinding): (() => void) => {
    const { element: video, stream } = binding;
    const tracks = captureTracks(stream);
    const resumeIfPaused = () => {
      if (!binding.suspended && binding.texture && video.srcObject) {
        void video.play().catch(() => undefined);
      }
    };
    const onResize = () => reviveCapture(rt, binding);
    const onUnmute = () => reviveCapture(rt, binding);
    const timer = window.setInterval(() => {
      if (binding.suspended || !binding.texture) {
        return;
      }
      if (!tracks.some((track) => track.readyState === 'live')) {
        return;
      }
      const surface = readCaptureSurface(stream);
      const surfaceActive = surface.width >= MIN_CAPTURE_PICTURE && surface.height >= MIN_CAPTURE_PICTURE;
      const surfaceReturned =
        surfaceActive &&
        (binding.lastSurfaceWidth < MIN_CAPTURE_PICTURE || binding.lastSurfaceHeight < MIN_CAPTURE_PICTURE);
      binding.lastSurfaceWidth = surface.width;
      binding.lastSurfaceHeight = surface.height;

      // Window came back from a stub size (common when Chrome reports 0×0 while minimised).
      if (surfaceReturned) {
        reviveCapture(rt, binding);
        return;
      }
      // Keep the callback chain armed; never re-attach just because frames are quiet — WGC 0 Hz is normal
      // for a static Spotify window and re-attaching there permanently freezes some Chromium builds.
      if (binding.frameCallback === null && supportsVideoFrameCallback(video)) {
        watchCaptureFrames(rt, binding);
      } else if (!supportsVideoFrameCallback(video) && captureHasPicture(binding)) {
        if (presentCaptureFrame(binding, performance.now())) {
          requestFrame(rt);
        }
      }
    }, CAPTURE_WATCHDOG_MS);

    for (const track of tracks) {
      track.addEventListener('unmute', onUnmute);
    }
    video.addEventListener('resize', onResize);
    video.addEventListener('pause', resumeIfPaused);
    return () => {
      window.clearInterval(timer);
      for (const track of tracks) {
        track.removeEventListener('unmute', onUnmute);
      }
      video.removeEventListener('resize', onResize);
      video.removeEventListener('pause', resumeIfPaused);
    };
  };

  const layout = (rt: Runtime): void => {
    const letterbox = letterboxComposition(rt.composition, rt.viewport);
    rt.frame.position.set(letterbox.offsetX, letterbox.offsetY);
    rt.frame.scale.set(letterbox.scale);
    rt.frameMask.clear().rect(0, 0, rt.composition.width, rt.composition.height).fill(0xffffff);
    const width = rt.composition.width * letterbox.scale;
    const height = rt.composition.height * letterbox.scale;
    rt.projectOutline.clear();
    const flush =
      letterbox.offsetX < 0.5 &&
      letterbox.offsetY < 0.5 &&
      Math.abs(width - rt.viewport.width) < 1 &&
      Math.abs(height - rt.viewport.height) < 1;
    if (!flush && width > 0 && height > 0) {
      rt.projectOutline.rect(letterbox.offsetX, letterbox.offsetY, width, height).stroke({
        width: 1,
        color: PROJECT_OUTLINE,
        alpha: 0.55,
        alignment: 1,
        pixelLine: true,
      });
    }
  };

  const releaseImage = (rt: Runtime, holder: ContentHolder): void => {
    if (!holder.image) {
      return;
    }
    holder.image.view?.destroy(false);
    rt.textures.release(holder.image.url, holder.image.scaleMode);
    holder.image = null;
  };

  const releaseCapture = (holder: ContentHolder): void => {
    const binding = holder.capture;
    if (!binding) {
      return;
    }
    holder.capture = null;
    binding.stopWatching?.();
    binding.stopWatching = null;
    if (binding.frameCallback !== null) {
      binding.element.cancelVideoFrameCallback(binding.frameCallback);
      binding.frameCallback = null;
    }
    binding.fit = null;
    binding.texture?.destroy(binding.ownsElement);
    binding.texture = null;
    if (binding.ownsElement) {
      binding.element.pause();
      binding.element.srcObject = null;
      binding.element.removeAttribute('src');
    } else {
      binding.releaseShared?.();
    }
  };

  const clearContent = (rt: Runtime, holder: ContentHolder): void => {
    for (const child of holder.content.removeChildren()) {
      child.destroy(DESTROY_OWNED);
    }
    holder.relayout = null;
    holder.cropGhost = null;
    holder.bars = null;
    holder.plate = null;
    holder.content.visible = true;
    holder.content.mask = null;
    holder.maskSprite = null;
    holder.content.filters = null;
    maskKeys.delete(holder);
    releaseImage(rt, holder);
    releaseCapture(holder);
    for (const disposable of holder.disposables) {
      disposable.destroy();
    }
    holder.disposables = [];
  };

  const destroyHolder = (rt: Runtime, holder: ContentHolder): void => {
    clearContent(rt, holder);
    holder.content.destroy();
  };

  /** Loads a shared texture and hands the caller a per-holder view; stale results are dropped. */
  const loadImage = (
    rt: Runtime,
    holder: ContentHolder,
    url: string,
    scaleMode: TextureScaleMode,
    describe: string,
    onLoaded: (texture: Texture, binding: ImageBinding) => void,
    onFailed?: () => void,
  ): Promise<void> => {
    const binding: ImageBinding = { url, scaleMode, view: null };
    holder.image = binding;
    return rt.textures.acquire(url, scaleMode).then(
      (texture) => {
        if (runtime !== rt || holder.image !== binding) {
          return;
        }
        onLoaded(texture, binding);
        requestFrame(rt);
      },
      (error: unknown) => {
        if (runtime !== rt || holder.image !== binding) {
          return;
        }
        report({ kind: 'render-failed', message: `${describe} failed to load: ${errorMessage(error)}` });
        if (onFailed) {
          onFailed();
          requestFrame(rt);
        }
      },
    );
  };

  const drawImage = (rt: Runtime, node: ElementNode, element: ImageElement, url: string | null): Promise<void> => {
    const box = { width: element.transform.width, height: element.transform.height };
    if (!url) {
      drawPlaceholder(node.content, box, element.name, 'image unavailable');
      return Promise.resolve();
    }

    const placeholder = new Container();
    drawPlaceholder(placeholder, box, element.name, 'loading image');
    node.content.addChild(placeholder);

    const scaleMode: TextureScaleMode = element.settings.smoothing ? 'linear' : 'nearest';
    return loadImage(
      rt,
      node,
      url,
      scaleMode,
      `Image for element ${element.id}`,
      (texture, binding) => {
        const view = new Texture({ source: texture.source, frame: new Rectangle(), dynamic: true });
        binding.view = view;
        const sprite = new Sprite(view);
        const ghost = createCropGhost(node, texture.source, node.id === cropPreviewId);
        const fit = (next: ContentLayout) => {
          const whole = { width: texture.width, height: texture.height };
          const frame = cropFrame(next.crop, whole);
          view.frame.copyFrom(new Rectangle(frame.x, frame.y, frame.width, frame.height));
          view.update();
          const rect = fitContentRect(element.settings.fitMode, next, frame);
          sprite.position.set(rect.x, rect.y);
          sprite.setSize(rect.width, rect.height);
          fitCropGhost(ghost, whole, frame, rect);
        };
        fit({ ...box, crop: element.crop });

        placeholder.destroy(DESTROY_OWNED);
        node.content.addChild(sprite);
        const mask = clipTo(node.content, sprite, box, element.settings.cornerRadius);
        node.relayout = (next) => {
          fit(next);
          drawClipShape(mask, next, element.settings.cornerRadius);
        };
      },
      () => {
        placeholder.destroy(DESTROY_OWNED);
        drawPlaceholder(node.content, box, element.name, 'image failed to load');
      },
    );
  };

  const resolveImageUrl = (element: ImageElement): string | null => {
    const assetId = options.resolveSourceAssetId(element.sourceId);
    if (!assetId) {
      return null;
    }
    return options.resolveAssetUrl(assetId);
  };

  const drawScreen = (
    rt: Runtime,
    node: ElementNode,
    element: ScreenElement,
    stream: MediaStream | null,
  ): Promise<void> => {
    const box = { width: element.transform.width, height: element.transform.height };
    if (!stream) {
      drawPlaceholder(
        node.content,
        box,
        element.name,
        options.missingScreenCaption?.(element.sourceId) ?? 'screen unavailable',
      );
      return Promise.resolve();
    }

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    const binding: CaptureBinding = {
      sourceId: element.sourceId,
      stream,
      element: video,
      texture: null,
      fit: null,
      width: 0,
      height: 0,
      frameCallback: null,
      nextDrawAt: Number.NEGATIVE_INFINITY,
      suspended: false,
      lastCallbackAt: performance.now(),
      lastPresentedFrames: -1,
      reattachedAt: Number.NEGATIVE_INFINITY,
      forcePresentUntil: 0,
      lastSurfaceWidth: 0,
      lastSurfaceHeight: 0,
      stopWatching: null,
      ownsElement: true,
      releaseShared: null,
    };
    node.capture = binding;

    const placeholder = new Container();
    drawPlaceholder(placeholder, box, element.name, 'loading screen');
    node.content.addChild(placeholder);

    return new Promise((resolve) => {
      const stillCurrent = () => runtime === rt && node.capture === binding;

      const fail = () => {
        if (!stillCurrent()) {
          resolve();
          return;
        }
        placeholder.destroy(DESTROY_OWNED);
        drawPlaceholder(node.content, box, element.name, 'screen failed');
        report({ kind: 'render-failed', message: `Screen for element ${element.id} failed to show` });
        requestFrame(rt);
        resolve();
      };

      const showFrame = () => {
        if (!stillCurrent() || binding.texture) {
          resolve();
          return;
        }
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (width <= 0 || height <= 0) {
          fail();
          return;
        }
        // Dynamic, so the sprite re-measures whenever `fit` moves the crop frame (new crop or a capture
        // resolution change); otherwise it keeps the first frame's bounds and the re-fit scale zooms the picture.
        const texture = new Texture({
          source: new ImageSource({ resource: video }),
          frame: new Rectangle(0, 0, width, height),
          dynamic: true,
        });
        binding.texture = texture;
        const sprite = new Sprite(texture);
        const ghost = createCropGhost(node, texture.source, node.id === cropPreviewId);
        let fitLayout: ContentLayout = { ...box, crop: element.crop };
        binding.fit = (contentWidth, contentHeight) => {
          const whole = { width: contentWidth, height: contentHeight };
          const frame = cropFrame(fitLayout.crop, whole);
          texture.frame.copyFrom(new Rectangle(frame.x, frame.y, frame.width, frame.height));
          texture.update();
          const rect = fitContentRect(element.settings.fitMode, fitLayout, frame);
          sprite.position.set(rect.x, rect.y);
          sprite.setSize(rect.width, rect.height);
          fitCropGhost(ghost, whole, frame, rect);
        };
        binding.width = width;
        binding.height = height;
        binding.fit(width, height);
        placeholder.destroy(DESTROY_OWNED);
        node.content.addChild(sprite);
        const mask = clipTo(node.content, sprite, box, element.settings.cornerRadius);
        node.relayout = (next) => {
          fitLayout = next;
          binding.fit?.(binding.width, binding.height);
          drawClipShape(mask, next, element.settings.cornerRadius);
        };
        void video.play().catch(() => undefined);
        binding.lastCallbackAt = performance.now();
        watchCaptureFrames(rt, binding);
        binding.stopWatching = watchCaptureHealth(rt, binding);
        requestFrame(rt);
        options.onCapturePicture?.(element.sourceId, { width, height }, 'shown');
        resolve();
      };

      video.addEventListener('loadeddata', showFrame, { once: true });
      video.addEventListener('error', fail, { once: true });
      video.addEventListener('play', () => {
        if (stillCurrent()) {
          requestFrame(rt);
        }
      });
    });
  };

  const mediaToken = (element: SceneElement): string | null => {
    if (element.type === 'image') {
      return resolveImageUrl(element);
    }
    if (element.type === 'screen') {
      return options.resolveScreenStream(element.sourceId)?.id ?? null;
    }
    if (element.type === 'camera') {
      return options.resolveCameraStream?.(element.sourceId)?.id ?? null;
    }
    if (element.type === 'video' || element.type === 'animation') {
      return options.resolveVideoFile?.(element.sourceId)?.url ?? null;
    }
    return null;
  };

  const visualFit = (
    element: SceneElement,
  ): { fitMode: 'contain' | 'cover' | 'fill' | 'none'; cornerRadius: number } => {
    if (element.type === 'camera' || element.type === 'video' || element.type === 'image') {
      return { fitMode: element.settings.fitMode, cornerRadius: element.settings.cornerRadius };
    }
    return { fitMode: 'contain', cornerRadius: 0 };
  };

  const applyBlur = (node: ElementNode, element: SceneElement): void => {
    const blur = element.effects.find((effect) => effect.type === 'blur' && effectPlayback(effect) === 'live');
    if (blur && blur.type === 'blur') {
      const current = node.content.filters?.[0];
      if (current instanceof BlurFilter) {
        current.strength = blur.parameters.radius;
      } else {
        node.content.filters = [new BlurFilter({ strength: blur.parameters.radius })];
      }
      return;
    }
    if (node.content.filters?.length) {
      node.content.filters = null;
    }
  };

  const syncMask = (rt: Runtime, node: ElementNode, element: SceneElement): void => {
    const mask = element.effects.find((effect) => effect.type === 'mask' && effectPlayback(effect) === 'live');
    const nextKey = mask && mask.type === 'mask' ? mask.parameters.sourceId : '';
    if (maskKeys.get(node) === nextKey) {
      return;
    }
    maskKeys.set(node, nextKey);
    if (node.maskSprite) {
      node.content.mask = null;
      node.maskSprite.destroy();
      node.maskSprite = null;
    }
    if (!mask || mask.type !== 'mask') {
      return;
    }
    const assetId = options.resolveSourceAssetId(mask.parameters.sourceId);
    const url = assetId ? options.resolveAssetUrl(assetId) : null;
    if (!url) {
      report({
        kind: 'render-failed',
        message: `Mask for element ${element.id} is not an image in the frame`,
      });
      return;
    }
    void rt.textures.acquire(url, 'linear').then(
      (texture) => {
        if (runtime !== rt || maskKeys.get(node) !== nextKey) {
          rt.textures.release(url, 'linear');
          return;
        }
        const sprite = new Sprite(texture);
        sprite.width = element.transform.width;
        sprite.height = element.transform.height;
        node.maskSprite = sprite;
        node.content.addChild(sprite);
        node.content.mask = sprite;
        node.disposables.push({ destroy: () => rt.textures.release(url, 'linear') });
        requestFrame(rt);
      },
      () => {
        report({ kind: 'render-failed', message: `Mask image for element ${element.id} failed to load` });
      },
    );
  };

  const drawStill = (rt: Runtime, node: ElementNode, element: SceneElement, url: string | null): Promise<void> => {
    const fit = visualFit(element);
    return drawImage(
      rt,
      node,
      {
        ...element,
        type: 'image',
        sourceId: 'sourceId' in element ? element.sourceId : element.id,
        settings: { fitMode: fit.fitMode, cornerRadius: fit.cornerRadius, maskSourceId: null, smoothing: true },
      },
      url,
    );
  };

  const drawSharedVideo = (
    rt: Runtime,
    node: ElementNode,
    element: Extract<SceneElement, { sourceId: SourceId }>,
    key: string,
    attach: (video: HTMLVideoElement) => void,
    failure: string,
  ): Promise<void> => {
    const box = { width: element.transform.width, height: element.transform.height };
    const releaseShared = retainSharedVideo(key, attach);
    const video = sharedVideos.get(key)?.element;
    if (!video) {
      releaseShared();
      drawPlaceholder(node.content, box, element.name, failure);
      return Promise.resolve();
    }
    const fit = visualFit(element);
    const binding: CaptureBinding = {
      sourceId: element.sourceId,
      stream: video.srcObject instanceof MediaStream ? video.srcObject : new MediaStream(),
      element: video,
      texture: null,
      fit: null,
      width: 0,
      height: 0,
      frameCallback: null,
      nextDrawAt: Number.NEGATIVE_INFINITY,
      suspended: false,
      lastCallbackAt: performance.now(),
      lastPresentedFrames: -1,
      reattachedAt: Number.NEGATIVE_INFINITY,
      forcePresentUntil: 0,
      lastSurfaceWidth: 0,
      lastSurfaceHeight: 0,
      stopWatching: null,
      ownsElement: false,
      releaseShared,
    };
    node.capture = binding;
    const placeholder = new Container();
    drawPlaceholder(placeholder, box, element.name, 'loading');
    node.content.addChild(placeholder);

    return new Promise((resolve) => {
      const stillCurrent = () => runtime === rt && node.capture === binding;
      const fail = () => {
        if (!stillCurrent()) {
          resolve();
          return;
        }
        placeholder.destroy(DESTROY_OWNED);
        drawPlaceholder(node.content, box, element.name, failure);
        report({ kind: 'render-failed', message: `${failure} (${element.id})` });
        requestFrame(rt);
        resolve();
      };
      const showFrame = () => {
        if (!stillCurrent() || binding.texture) {
          resolve();
          return;
        }
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (width <= 0 || height <= 0) {
          fail();
          return;
        }
        const texture = new Texture({
          source: new ImageSource({ resource: video }),
          frame: new Rectangle(0, 0, width, height),
          dynamic: true,
        });
        binding.texture = texture;
        const sprite = new Sprite(texture);
        let fitLayout: ContentLayout = { ...box, crop: element.crop };
        binding.fit = (contentWidth, contentHeight) => {
          const whole = { width: contentWidth, height: contentHeight };
          const frame = cropFrame(fitLayout.crop, whole);
          texture.frame.copyFrom(new Rectangle(frame.x, frame.y, frame.width, frame.height));
          texture.update();
          const rect = fitContentRect(fit.fitMode, fitLayout, frame);
          sprite.position.set(rect.x, rect.y);
          sprite.setSize(rect.width, rect.height);
        };
        binding.width = width;
        binding.height = height;
        binding.fit(width, height);
        placeholder.destroy(DESTROY_OWNED);
        node.content.addChild(sprite);
        const mask = clipTo(node.content, sprite, box, fit.cornerRadius);
        node.relayout = (next) => {
          fitLayout = next;
          binding.fit?.(binding.width, binding.height);
          drawClipShape(mask, next, fit.cornerRadius);
        };
        void video.play().catch(() => fail());
        watchCaptureFrames(rt, binding);
        requestFrame(rt);
        resolve();
      };
      if (video.readyState >= 2 && video.videoWidth > 0) {
        showFrame();
        return;
      }
      video.addEventListener('loadeddata', showFrame, { once: true });
      video.addEventListener('error', fail, { once: true });
    });
  };

  const syncElement = (rt: Runtime, node: ElementNode, element: SceneElement): Promise<void> => {
    applyPlacement(node, element.transform, element.appearance, element.visibility);

    const token = mediaToken(element);
    const key = elementContentKey(element, token);
    const layout = { width: element.transform.width, height: element.transform.height, crop: element.crop };
    if (key === node.contentKey) {
      applyBlur(node, element);
      syncMask(rt, node, element);
      if (sameLayout(node.contentLayout, layout)) {
        return Promise.resolve();
      }
      if (node.relayout) {
        node.relayout(layout);
        node.contentLayout = layout;
        return Promise.resolve();
      }
    }
    node.contentKey = key;
    node.contentLayout = layout;
    clearContent(rt, node);

    const finish = (drawn: Promise<void> | void): Promise<void> => {
      applyBlur(node, element);
      syncMask(rt, node, element);
      return Promise.resolve(drawn);
    };

    switch (layerDrawKind(element.type)) {
      case 'shape':
        if (element.type === 'shape') {
          drawShape(node, element);
        }
        return finish();
      case 'text':
        if (element.type === 'text') {
          drawText(node, element);
        }
        return finish();
      case 'image':
        if (element.type === 'image') {
          if (!options.resolveSourceAssetId(element.sourceId)) {
            report({
              kind: 'render-failed',
              message: `Image element ${element.id} references source ${element.sourceId} without an image asset`,
            });
          }
          return finish(drawImage(rt, node, element, token));
        }
        return finish();
      case 'screen':
        if (element.type === 'screen') {
          return finish(drawScreen(rt, node, element, options.resolveScreenStream(element.sourceId)));
        }
        return finish();
      case 'browser-plate':
        drawPlaceholder(node.content, element.transform, element.name, BROWSER_PLATE_CAPTION);
        node.plate = node.content;
        node.content.visible = false;
        return finish();
      case 'camera': {
        if (element.type !== 'camera') {
          return finish();
        }
        const stream = options.resolveCameraStream?.(element.sourceId) ?? null;
        const track = stream?.getVideoTracks()[0];
        if (!stream || !track || track.readyState === 'ended') {
          drawPlaceholder(node.content, element.transform, element.name, 'camera unavailable');
          return finish();
        }
        track.addEventListener('ended', () => {
          if (runtime === rt && node.capture?.sourceId === element.sourceId) {
            clearContent(rt, node);
            drawPlaceholder(node.content, element.transform, element.name, 'camera ended');
            requestFrame(rt);
          }
        });
        return finish(
          drawSharedVideo(
            rt,
            node,
            element,
            `camera:${element.sourceId}:${stream.id}`,
            (video) => {
              video.srcObject = stream;
            },
            'camera unavailable',
          ),
        );
      }
      case 'video':
      case 'animation': {
        if (element.type !== 'video' && element.type !== 'animation') {
          return finish();
        }
        const file = options.resolveVideoFile?.(element.sourceId) ?? null;
        if (!file?.url) {
          drawPlaceholder(node.content, element.transform, element.name, `${element.type} unavailable`);
          return finish();
        }
        if (file.mediaKind === 'image') {
          return finish(drawStill(rt, node, element, file.url));
        }
        const loop = element.type === 'video' ? element.settings.loop : file.loop;
        return finish(
          drawSharedVideo(
            rt,
            node,
            element,
            `file:${file.url}`,
            (video) => {
              video.loop = loop;
              video.src = file.url ?? '';
            },
            `${element.type} unavailable`,
          ),
        );
      }
      case 'overlay':
        if (element.type === 'overlay') {
          const text = overlayText(element.content);
          drawPlaceholder(node.content, element.transform, element.overlayKind, text || element.name);
        }
        return finish();
      case 'audio-visual': {
        const bars = new Graphics();
        node.bars = bars;
        node.content.addChild(bars);
        paintBars(bars, element.transform, null);
        return finish();
      }
      default:
        drawPlaceholder(node.content, element.transform, element.name, element.type);
        return finish();
    }
  };

  const syncBackground = (rt: Runtime, state: SceneState, background: SceneBackground): Promise<void> => {
    const url = background.kind === 'image' ? options.resolveAssetUrl(background.assetId) : null;
    const key = JSON.stringify([background, rt.composition, url]);
    const holder = state.background;
    if (key === holder.contentKey) {
      return Promise.resolve();
    }
    holder.contentKey = key;
    clearContent(rt, holder);

    if (background.kind === 'color') {
      holder.content.addChild(
        new Graphics().rect(0, 0, rt.composition.width, rt.composition.height).fill(background.color),
      );
      return Promise.resolve();
    }
    if (background.kind === 'none') {
      const fill = options.compositionFillWhenBackgroundNone;
      if (fill !== undefined) {
        holder.content.addChild(new Graphics().rect(0, 0, rt.composition.width, rt.composition.height).fill(fill));
      }
      return Promise.resolve();
    }
    if (!url) {
      report({ kind: 'io', message: `Background asset ${background.assetId} is not available` });
      return Promise.resolve();
    }
    return loadImage(rt, holder, url, 'linear', `Background asset ${background.assetId}`, (texture) => {
      const sprite = new Sprite(texture);
      const rect = fitContentRect('cover', rt.composition, { width: texture.width, height: texture.height });
      sprite.position.set(rect.x, rect.y);
      sprite.setSize(rect.width, rect.height);
      holder.content.addChild(sprite);
    });
  };

  const createSceneState = (rt: Runtime): SceneState => {
    const state: SceneState = {
      container: new Container(),
      background: createContentHolder(),
      elements: new Map(),
      groups: new Map(),
      reportedIssues: new Set(),
    };
    state.container.addChild(state.background.content);
    rt.frame.addChild(state.container);
    return state;
  };

  const destroyElementNode = (rt: Runtime, node: ElementNode): void => {
    destroyHolder(rt, node);
    node.root.destroy(DESTROY_OWNED);
  };

  const destroySceneState = (rt: Runtime, state: SceneState): void => {
    for (const node of state.elements.values()) {
      destroyElementNode(rt, node);
    }
    destroyHolder(rt, state.background);
    state.container.destroy(DESTROY_OWNED);
    state.elements.clear();
    state.groups.clear();
  };

  const ensureElementNode = (state: SceneState, id: ElementId): ElementNode => {
    const existing = state.elements.get(id);
    if (existing) {
      return existing;
    }
    const node: ElementNode = { id, ...createTransformNode(), ...createContentHolder() };
    node.flip.addChild(node.content);
    state.elements.set(id, node);
    return node;
  };

  const ensureGroupNode = (state: SceneState, group: SceneGroup): GroupNode => {
    const existing = state.groups.get(group.id);
    if (existing) {
      return existing;
    }
    const node: GroupNode = { id: group.id, ...createTransformNode() };
    state.groups.set(group.id, node);
    return node;
  };

  const syncScene = (rt: Runtime, state: SceneState, scene: Scene): Promise<void>[] => {
    const plan = planSceneSync(scene, {
      elementIds: new Set(state.elements.keys()),
      groupIds: new Set(state.groups.keys()),
    });

    const issueMessages = new Set(plan.issues.map((issue) => issue.message));
    for (const message of issueMessages) {
      if (!state.reportedIssues.has(message)) {
        report({ kind: 'render-failed', message });
      }
    }
    state.reportedIssues = issueMessages;

    for (const id of plan.removedElementIds) {
      const node = state.elements.get(id);
      if (node) {
        destroyElementNode(rt, node);
        state.elements.delete(id);
      }
    }

    const loads: Promise<void>[] = [syncBackground(rt, state, scene.background)];
    const rootContainers: Container[] = [state.background.content];

    for (const root of plan.roots) {
      if (root.kind === 'element') {
        const node = ensureElementNode(state, root.element.id);
        loads.push(syncElement(rt, node, root.element));
        rootContainers.push(node.root);
        continue;
      }

      const groupNode = ensureGroupNode(state, root.group);
      applyPlacement(groupNode, root.group.transform, root.group.appearance, true);
      const memberContainers = root.members.map((member) => {
        const node = ensureElementNode(state, member.id);
        loads.push(syncElement(rt, node, member));
        return node.root;
      });
      placeChildren(groupNode.flip, memberContainers);
      rootContainers.push(groupNode.root);
    }

    placeChildren(state.container, rootContainers);

    for (const id of plan.removedGroupIds) {
      state.groups.get(id)?.root.destroy({ children: true });
      state.groups.delete(id);
    }

    return loads;
  };

  const syncCompositionSize = (rt: Runtime): void => {
    const composition = options.getCompositionSize();
    if (!isValidSize(composition)) {
      throw new Error(`Invalid composition size ${composition.width}×${composition.height}`);
    }
    if (composition.width !== rt.composition.width || composition.height !== rt.composition.height) {
      rt.composition = { width: composition.width, height: composition.height };
      ensureOutputTarget(rt);
      layout(rt);
    }
  };

  const pruneScenes = (rt: Runtime, activeSceneId: SceneId): void => {
    const retained = new Set(options.getRetainedSceneIds());
    for (const [sceneId, state] of rt.scenes) {
      if (sceneId !== activeSceneId && !retained.has(sceneId)) {
        destroySceneState(rt, state);
        rt.scenes.delete(sceneId);
      }
    }
  };

  const measureHost = (host: HTMLElement): Size => ({
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
  });

  const resizeRuntime = (rt: Runtime, viewport: CompositionViewport): void => {
    rt.viewport = { width: viewport.width, height: viewport.height };
    rt.app.renderer.resize(viewport.width, viewport.height, displayResolution());
    layout(rt);
    renderNow(rt);
  };

  return {
    initialize(viewport) {
      return serialize(async (): Promise<EngineResult> => {
        if (viewport && !isValidSize(viewport)) {
          return portErr({ kind: 'io', message: `Invalid viewport ${viewport.width}×${viewport.height}` });
        }
        if (runtime) {
          if (viewport) {
            resizeRuntime(runtime, viewport);
          }
          return portOk(undefined);
        }

        const host = options.getHost();
        if (!host) {
          return portErr({ kind: 'io', message: 'Composition host element is not mounted' });
        }
        const composition = options.getCompositionSize();
        if (!isValidSize(composition)) {
          return portErr({
            kind: 'io',
            message: `Invalid composition size ${composition.width}×${composition.height}`,
          });
        }

        const size = viewport ?? measureHost(host);
        const app = new Application();
        try {
          await app.init({
            width: size.width,
            height: size.height,
            resolution: displayResolution(),
            autoDensity: true,
            antialias: true,
            backgroundAlpha: 0,
            autoStart: false,
            preference: 'webgl',
          });
        } catch (error) {
          return portErr({ kind: 'io', message: `PixiJS failed to initialize: ${errorMessage(error)}` });
        }
        const stopIdleTimers = quietSystemTicker(app);

        const canvas = app.canvas;
        canvas.style.position = 'absolute';
        canvas.style.inset = '0';
        canvas.style.display = 'block';
        host.appendChild(canvas);

        const frame = new Container();
        const frameMask = new Graphics();
        frame.addChild(frameMask);
        frame.mask = frameMask;
        const projectOutline = new Graphics();
        app.stage.addChild(frame, projectOutline);

        const outputCanvas = document.createElement('canvas');
        outputCanvas.dataset.outputFrame = 'true';
        outputCanvas.setAttribute('aria-hidden', 'true');
        const rt: Runtime = {
          app,
          frame,
          frameMask,
          projectOutline,
          scenes: new Map(),
          textures: createPixiTextureCache(),
          composition: { width: composition.width, height: composition.height },
          viewport: { width: size.width, height: size.height },
          frameRequest: null,
          stopIdleTimers,
          outputCanvas,
          outputContext: outputCanvas.getContext('2d'),
          outputTexture: null,
          outputCaptureActive: false,
          deliveredFrames: 0,
          firstDeliveredAt: null,
          lastDeliveredAt: null,
          activeSceneId: null,
          fade: null,
          reportedTransitions: new Set(),
        };
        runtime = rt;
        ensureOutputTarget(rt);
        layout(rt);
        renderNow(rt);
        return portOk(undefined);
      });
    },

    async render(scene) {
      const rt = runtime;
      if (!rt) {
        return portErr({ kind: 'not-initialized' });
      }

      let loads: Promise<void>[];
      try {
        syncCompositionSize(rt);
        const state = rt.scenes.get(scene.id) ?? createSceneState(rt);
        rt.scenes.set(scene.id, state);
        loads = syncScene(rt, state, scene);
        const previousId = rt.activeSceneId;
        if (previousId && previousId !== scene.id) {
          const transition = options.resolveSceneTransition?.(scene.id) ?? null;
          const player = transition ? transitionPlayer(transition.type) : 'cut';
          if (player === 'missing' && transition && !rt.reportedTransitions.has(transition.type)) {
            rt.reportedTransitions.add(transition.type);
            report({
              kind: 'render-failed',
              message: `Transition ${transition.type} has no player`,
            });
          }
          if (player === 'fade' && transition && transition.durationMs > 0 && rt.scenes.has(previousId)) {
            rt.fade = {
              fromId: previousId,
              toId: scene.id,
              startedAt: performance.now(),
              durationMs: transition.durationMs,
              curve: transition.curve ?? 'linear',
            };
          } else {
            rt.fade = null;
          }
        }
        rt.activeSceneId = scene.id;
        for (const [sceneId, other] of rt.scenes) {
          const inFade = rt.fade !== null && (sceneId === rt.fade.fromId || sceneId === rt.fade.toId);
          if (!inFade) {
            other.container.alpha = 1;
          }
          const active = sceneId === scene.id || inFade;
          other.container.visible = active;
          if (active) {
            resumeSceneCaptures(other);
          } else {
            pauseSceneCaptures(other);
          }
        }
        pruneScenes(rt, scene.id);
        renderNow(rt);
      } catch (error) {
        return portErr({ kind: 'render-failed', message: `Scene ${scene.id}: ${errorMessage(error)}` });
      }

      await Promise.all(loads);
      return portOk(undefined);
    },

    async resize(viewport) {
      const rt = runtime;
      if (!rt) {
        return portErr({ kind: 'not-initialized' });
      }
      if (!isValidSize(viewport)) {
        return portErr({ kind: 'io', message: `Invalid viewport ${viewport.width}×${viewport.height}` });
      }
      if (
        viewport.width !== rt.viewport.width ||
        viewport.height !== rt.viewport.height ||
        displayResolution() !== rt.app.renderer.resolution
      ) {
        resizeRuntime(rt, viewport);
      }
      return portOk(undefined);
    },

    getOutputCanvas() {
      return runtime?.outputCanvas ?? null;
    },

    setOutputCaptureActive(active: boolean) {
      const rt = runtime;
      if (!rt) {
        return;
      }
      rt.outputCaptureActive = active;
      if (active) {
        rt.deliveredFrames = 0;
        rt.firstDeliveredAt = null;
        rt.lastDeliveredAt = null;
        publishOutput(rt);
        requestFrame(rt);
      }
    },

    readFrameDelivery(): FrameDelivery {
      const rt = runtime;
      if (!rt) {
        return { deliveredFrames: 0, firstDeliveredAt: null, lastDeliveredAt: null, width: 0, height: 0 };
      }
      return {
        deliveredFrames: rt.deliveredFrames,
        firstDeliveredAt: rt.firstDeliveredAt,
        lastDeliveredAt: rt.lastDeliveredAt,
        width: rt.outputCanvas.width,
        height: rt.outputCanvas.height,
      };
    },

    previewCrop(elementId) {
      cropPreviewId = elementId;
      const rt = runtime;
      if (!rt) {
        return;
      }
      for (const scene of rt.scenes.values()) {
        for (const node of scene.elements.values()) {
          if (node.cropGhost) {
            node.cropGhost.visible = node.id === cropPreviewId;
          }
        }
      }
      requestFrame(rt);
    },

    dispose() {
      return serialize(async (): Promise<EngineResult> => {
        const rt = runtime;
        if (!rt) {
          return portOk(undefined);
        }
        runtime = null;
        rt.outputCaptureActive = false;
        if (rt.frameRequest !== null) {
          cancelAnimationFrame(rt.frameRequest);
        }
        rt.stopIdleTimers();
        try {
          for (const state of rt.scenes.values()) {
            destroySceneState(rt, state);
          }
          rt.scenes.clear();
          rt.outputTexture?.destroy(true);
          rt.textures.destroy();
          rt.app.destroy({ removeView: true }, DESTROY_OWNED);
        } catch (error) {
          return portErr({ kind: 'io', message: `PixiJS teardown failed: ${errorMessage(error)}` });
        }
        return portOk(undefined);
      });
    },
  };
};
