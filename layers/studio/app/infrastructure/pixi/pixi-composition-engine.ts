import {
  Application,
  type BLEND_MODES,
  CanvasTextMetrics,
  Container,
  FillGradient,
  type FillInput,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  type TextDropShadow,
  TextStyle,
  Texture,
} from 'pixi.js';

import type { Appearance, BlendMode, Transform2D } from '../../models/common.domain';
import type { AssetId, ElementId, GroupId, SceneId, SourceId } from '../../models/ids.domain';
import type { Scene, SceneBackground } from '../../models/scene.domain';
import type { ImageElement, SceneElement, ShapeElement, TextElement } from '../../models/scene-element.domain';
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
  /** Non-fatal problems: failed texture loads, broken references inside a scene. */
  onDiagnostic?: (error: CompositionEngineError) => void;
};

type EngineResult = PortResult<void, CompositionEngineError>;

type ImageBinding = {
  url: string;
  scaleMode: TextureScaleMode;
  view: Texture | null;
};

type ContentHolder = {
  content: Container;
  contentKey: string | null;
  image: ImageBinding | null;
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
  scenes: Map<SceneId, SceneState>;
  textures: PixiTextureCache;
  composition: Size;
  viewport: Size;
  frameRequest: number | null;
};

const DESTROY_OWNED = { children: true, context: true, style: true } as const;
const PLACEHOLDER_FILL = 0x1f2937;
const PLACEHOLDER_STROKE = 0x64748b;
const PLACEHOLDER_TEXT = '#cbd5e1';

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const toBlendMode = (blendMode: BlendMode | undefined): BLEND_MODES => blendMode ?? 'inherit';

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
  image: null,
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

const clipTo = (parent: Container, target: Container, size: Size, radius: number): void => {
  const mask = new Graphics();
  if (radius > 0) {
    mask.roundRect(0, 0, size.width, size.height, Math.min(radius, size.width / 2, size.height / 2));
  } else {
    mask.rect(0, 0, size.width, size.height);
  }
  mask.fill(0xffffff);
  parent.addChild(mask);
  target.mask = mask;
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

  if (settings.shapeType === 'line') {
    graphics
      .moveTo(0, height / 2)
      .lineTo(width, height / 2)
      .stroke({
        width: Math.max(settings.strokeWidth, 1),
        color: settings.strokeColor ?? settings.fillColor ?? '#ffffff',
      });
    holder.content.addChild(graphics);
    return;
  }

  if (settings.shapeType === 'ellipse') {
    graphics.ellipse(width / 2, height / 2, width / 2, height / 2);
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
      if (runtime === rt) {
        rt.app.render();
      }
    });
  };

  const layout = (rt: Runtime): void => {
    const letterbox = letterboxComposition(rt.composition, rt.viewport);
    rt.frame.position.set(letterbox.offsetX, letterbox.offsetY);
    rt.frame.scale.set(letterbox.scale);
    rt.frameMask.clear().rect(0, 0, rt.composition.width, rt.composition.height).fill(0xffffff);
  };

  const releaseImage = (rt: Runtime, holder: ContentHolder): void => {
    if (!holder.image) {
      return;
    }
    holder.image.view?.destroy(false);
    rt.textures.release(holder.image.url, holder.image.scaleMode);
    holder.image = null;
  };

  const clearContent = (rt: Runtime, holder: ContentHolder): void => {
    for (const child of holder.content.removeChildren()) {
      child.destroy(DESTROY_OWNED);
    }
    releaseImage(rt, holder);
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
        const frame = cropFrame(element.crop, { width: texture.width, height: texture.height });
        binding.view = new Texture({
          source: texture.source,
          frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
        });
        const sprite = new Sprite(binding.view);
        const rect = fitContentRect(element.settings.fitMode, box, frame);
        sprite.position.set(rect.x, rect.y);
        sprite.setSize(rect.width, rect.height);

        placeholder.destroy(DESTROY_OWNED);
        node.content.addChild(sprite);
        clipTo(node.content, sprite, box, element.settings.cornerRadius);
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

  const syncElement = (rt: Runtime, node: ElementNode, element: SceneElement): Promise<void> => {
    applyPlacement(node, element.transform, element.appearance, element.visibility);

    const url = element.type === 'image' ? resolveImageUrl(element) : null;
    const key = elementContentKey(element, url);
    if (key === node.contentKey) {
      return Promise.resolve();
    }
    node.contentKey = key;
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

        const canvas = app.canvas;
        canvas.style.position = 'absolute';
        canvas.style.inset = '0';
        canvas.style.display = 'block';
        host.appendChild(canvas);

        const frame = new Container();
        const frameMask = new Graphics();
        frame.addChild(frameMask);
        frame.mask = frameMask;
        app.stage.addChild(frame);

        const rt: Runtime = {
          app,
          frame,
          frameMask,
          scenes: new Map(),
          textures: createPixiTextureCache(),
          composition: { width: composition.width, height: composition.height },
          viewport: { width: size.width, height: size.height },
          frameRequest: null,
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
          other.container.visible = sceneId === scene.id;
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
