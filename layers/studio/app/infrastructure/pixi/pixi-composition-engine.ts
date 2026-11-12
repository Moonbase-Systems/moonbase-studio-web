import {
  Application,
  type BLEND_MODES,
  CanvasTextMetrics,
  Container,
  FillGradient,
  type FillInput,
  Graphics,
  ImageSource,
  Rectangle,
  Sprite,
  Text,
  type TextDropShadow,
  TextStyle,
  Texture,
  Ticker,
} from 'pixi.js';

import type { Appearance, BlendMode, ElementCrop, Transform2D } from '../../models/common.domain';
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
import type { CompositionEngine, CompositionEngineError, CompositionViewport } from '../../ports/composition-engine';
import { portErr, portOk, type PortResult } from '../../ports/result';
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
import { elementContentKey, planSceneSync } from './composition-scene-sync';
import { createPixiTextureCache, type PixiTextureCache, type TextureScaleMode } from './pixi-texture-cache';

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
  /** Highest rate the preview redraws captures at; null or omitted redraws on every new capture frame. */
  getCapturePreviewFrameRate?: () => number | null;
  /** Fill inside the project frame when the scene has no background; preview-only by default. */
  compositionFillWhenBackgroundNone?: number;
  /** Capture size when its first frame shows and whenever the captured window changes size afterwards. */
  onCapturePicture?: (sourceId: SourceId, picture: Size, change: 'shown' | 'resized') => void;
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

  const renderNow = (rt: Runtime): void => {
    if (rt.frameRequest !== null) {
      cancelAnimationFrame(rt.frameRequest);
      rt.frameRequest = null;
    }
    rt.app.render();
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
      rt.app.render();
      if (polling) {
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
    if (captureTracks(stream).every((track) => track.readyState === 'ended')) {
      return false;
    }
    if (captureIsMuted(stream) && performance.now() > binding.forcePresentUntil) {
      return false;
    }
    return video.videoWidth >= MIN_CAPTURE_PICTURE && video.videoHeight >= MIN_CAPTURE_PICTURE;
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
      if (node.capture) {
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
      if (binding?.texture && binding.element.paused && !binding.element.ended) {
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
    if (width > 0 && height > 0) {
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
    binding.element.pause();
    binding.element.srcObject = null;
    binding.texture?.destroy(true);
    binding.texture = null;
  };

  const clearContent = (rt: Runtime, holder: ContentHolder): void => {
    for (const child of holder.content.removeChildren()) {
      child.destroy(DESTROY_OWNED);
    }
    holder.relayout = null;
    holder.cropGhost = null;
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
      drawPlaceholder(node.content, box, element.name, 'screen unavailable');
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

  const syncElement = (rt: Runtime, node: ElementNode, element: SceneElement): Promise<void> => {
    applyPlacement(node, element.transform, element.appearance, element.visibility);

    const url = element.type === 'image' ? resolveImageUrl(element) : null;
    const streamId = element.type === 'screen' ? (options.resolveScreenStream(element.sourceId)?.id ?? null) : null;
    const key = elementContentKey(element, url ?? streamId);
    const layout = { width: element.transform.width, height: element.transform.height, crop: element.crop };
    if (key === node.contentKey) {
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

    switch (element.type) {
      case 'shape':
        drawShape(node, element);
        return Promise.resolve();
      case 'text':
        drawText(node, element);
        return Promise.resolve();
      case 'image':
        if (!options.resolveSourceAssetId(element.sourceId)) {
          report({
            kind: 'render-failed',
            message: `Image element ${element.id} references source ${element.sourceId} without an image asset`,
          });
        }
        return drawImage(rt, node, element, url);
      case 'screen':
        return drawScreen(rt, node, element, options.resolveScreenStream(element.sourceId));
      default:
        drawPlaceholder(node.content, element.transform, element.name, element.type);
        return Promise.resolve();
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
        };
        runtime = rt;
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
        for (const [sceneId, other] of rt.scenes) {
          const active = sceneId === scene.id;
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
        if (rt.frameRequest !== null) {
          cancelAnimationFrame(rt.frameRequest);
        }
        rt.stopIdleTimers();
        try {
          for (const state of rt.scenes.values()) {
            destroySceneState(rt, state);
          }
          rt.scenes.clear();
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
