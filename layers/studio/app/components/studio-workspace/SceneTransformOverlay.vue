<script setup lang="ts">
import { useStudioCompositionEngine } from '../../composables/useCompositionEngine';
import { letterboxComposition } from '../../infrastructure/pixi/composition-geometry';
import { isRenderableElement } from '../../infrastructure/pixi/composition-scene-sync';
import type { ElementCrop, Transform2D } from '../../models/common.domain';
import type { ElementId, SceneId } from '../../models/ids.domain';
import type { SceneElement } from '../../models/scene-element.domain';
import {
  type Affine,
  applyAffine,
  boxCorners,
  canCrop,
  centreAnchor,
  cropElement,
  drawsAbove,
  elementAffine,
  type GestureResult,
  type Handle,
  handleCursor,
  handlePoint,
  HANDLES,
  hitTestScene,
  hitTestSceneExcluding,
  keepsAspectRatio,
  moveElement,
  parentAffine,
  pickCorner,
  pickHandle,
  pickSide,
  type Point,
  resizeElement,
  rotateElement,
  type SnapGuide,
} from '../../playback/scene-element-gesture';
import { useStudioSessionStore } from '../../store/studio-session.store';

const props = defineProps<{
  /** Element the composition canvas fills; the project frame is letterboxed inside it. */
  host: HTMLElement | null;
}>();

const HANDLE_RADIUS_PX = 4;
const HANDLE_HIT_PX = 8;
const SIDE_HIT_PX = 6;
/** Alt turns the element from around its corners, a little outside the box included. */
const ROTATE_HIT_PX = 16;
const SNAP_PX = 8;
const DRAG_THRESHOLD_PX = 3;
const ROTATE_STEP_DEGREES = 15;

const store = useStudioSessionStore();
const compositionEngine = useStudioCompositionEngine();
const root = ref<HTMLDivElement | null>(null);

type View = { originX: number; originY: number; scale: number };
const view = ref<View>({ originX: 0, originY: 0, scale: 1 });

const composition = computed(() => store.project?.settings.video ?? { width: 1920, height: 1080 });
const scene = computed(() => store.activeScene);

function measure(): void {
  const overlay = root.value;
  const host = props.host;
  if (!overlay || !host) {
    return;
  }
  const overlayRect = overlay.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  if (hostRect.width <= 0 || hostRect.height <= 0) {
    return;
  }
  const letterbox = letterboxComposition(composition.value, { width: hostRect.width, height: hostRect.height });
  view.value = {
    originX: hostRect.left - overlayRect.left + letterbox.offsetX,
    originY: hostRect.top - overlayRect.top + letterbox.offsetY,
    scale: letterbox.scale,
  };
}

const toScreen = (point: Point): Point => ({
  x: view.value.originX + point.x * view.value.scale,
  y: view.value.originY + point.y * view.value.scale,
});

function toProject(event: PointerEvent): Point {
  const rect = root.value?.getBoundingClientRect();
  return {
    x: (event.clientX - (rect?.left ?? 0) - view.value.originX) / view.value.scale,
    y: (event.clientY - (rect?.top ?? 0) - view.value.originY) / view.value.scale,
  };
}

const outlinePoints = (element: SceneElement): string => {
  const current = scene.value;
  if (!current) {
    return '';
  }
  return boxCorners(elementAffine(current, element), element.transform)
    .map(toScreen)
    .map((point) => `${point.x},${point.y}`)
    .join(' ');
};

const selected = computed(() => {
  const current = scene.value;
  if (!current) {
    return [];
  }
  const ids = new Set(store.selectedLayerIds);
  return current.elements.filter(
    (element) => ids.has(element.id) && element.visibility && isRenderableElement(element),
  );
});

const primary = computed(() => (selected.value.length === 1 ? selected.value[0]! : null));

const handles = computed(() => {
  const element = primary.value;
  const current = scene.value;
  if (!element || !current || element.locked) {
    return [];
  }
  const affine = elementAffine(current, element);
  return HANDLES.map((handle) => ({ id: handle.id, ...toScreen(handlePoint(affine, element.transform, handle)) }));
});

const hoveredId = ref<ElementId | null>(null);
const hovered = computed(() => {
  const id = hoveredId.value;
  if (!id || store.selectedLayerIds.includes(id)) {
    return null;
  }
  return scene.value?.elements.find((element) => element.id === id) ?? null;
});

const guides = ref<SnapGuide[]>([]);
const guideLines = computed(() => {
  const { originX, originY, scale } = view.value;
  const { width, height } = composition.value;
  return guides.value.map((guide) =>
    guide.axis === 'x'
      ? {
          x1: originX + guide.value * scale,
          y1: originY,
          x2: originX + guide.value * scale,
          y2: originY + height * scale,
        }
      : {
          x1: originX,
          y1: originY + guide.value * scale,
          x2: originX + width * scale,
          y2: originY + guide.value * scale,
        },
  );
});

type GestureKind = 'move' | 'resize' | 'rotate' | 'crop';

/** What a press at a point would do. */
type Zone = { element: SceneElement; kind: GestureKind; handle: Handle | null };

type Gesture = {
  kind: GestureKind;
  pointerId: number;
  sceneId: SceneId;
  elementId: ElementId;
  original: Transform2D;
  originalCrop: ElementCrop;
  /** Scene array index before the drag, used to restore stack when leaving a drop target. */
  originalIndex: number;
  start: Transform2D;
  parent: Affine;
  handle: Handle | null;
  keepAspect: boolean;
  startPointer: Point;
  startClient: Point;
  pointer: Point;
  shift: boolean;
  ctrl: boolean;
  dragging: boolean;
};

let gesture: Gesture | null = null;
let pendingFrame: number | null = null;
const cursor = ref('default');

/** Curved double arrow, turned so it bends away from the element's centre. */
function rotateCursor(angleDegrees: number): string {
  const turn = Math.round(angleDegrees + 90);
  const arrow = (stroke: string, width: number) =>
    `<g fill='none' stroke='${stroke}' stroke-width='${width}' stroke-linecap='round' stroke-linejoin='round'>` +
    `<path d='M4.2 15.2A11 11 0 0 1 19.8 15.2'/><path d='M4.2 11.2V15.2H8.2'/><path d='M19.8 11.2V15.2H15.8'/></g>`;
  // Cursor images cannot read CSS variables: surface (#050004) outline, on-surface (white) arrow.
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>` +
    `<g transform='rotate(${turn} 12 12)'>${arrow('#050004', 4)}${arrow('white', 1.75)}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, grab`;
}

/** Screen angle from the element's centre to the point, in degrees. */
function angleFromCentre(element: SceneElement, point: Point): number {
  const current = scene.value;
  if (!current) {
    return 0;
  }
  const centre = applyAffine(elementAffine(current, element), {
    x: element.transform.width / 2,
    y: element.transform.height / 2,
  });
  return (Math.atan2(point.y - centre.y, point.x - centre.x) * 180) / Math.PI;
}

function zoneAt(point: Point, altKey: boolean): Zone | null {
  const current = scene.value;
  if (!current) {
    return null;
  }
  const element = primary.value;
  if (element && !element.locked) {
    const affine = elementAffine(current, element);
    const size = element.transform;
    const scale = view.value.scale;
    if (altKey) {
      const corner = pickCorner(affine, size, point, ROTATE_HIT_PX / scale);
      if (corner) {
        return { element, kind: 'rotate', handle: corner };
      }
      const side = canCrop(element) ? pickSide(affine, size, point, SIDE_HIT_PX / scale) : null;
      if (side) {
        return { element, kind: 'crop', handle: side };
      }
    } else {
      const handle = pickHandle(affine, size, point, HANDLE_HIT_PX / scale);
      if (handle) {
        return { element, kind: 'resize', handle };
      }
    }
  }
  const hit = hitTestScene(current, point);
  return hit ? { element: hit, kind: 'move', handle: null } : null;
}

function cursorFor(zone: Zone | null, point: Point): string {
  if (!zone || zone.element.locked) {
    return 'default';
  }
  const current = scene.value;
  switch (zone.kind) {
    case 'rotate':
      return rotateCursor(angleFromCentre(zone.element, point));
    case 'resize':
    case 'crop':
      return current && zone.handle ? handleCursor(elementAffine(current, zone.element), zone.handle) : 'default';
    default:
      return 'move';
  }
}

function applyGesture(): void {
  pendingFrame = null;
  const active = gesture;
  if (!active || !active.dragging) {
    return;
  }
  const snap = active.ctrl ? null : { frame: composition.value, threshold: SNAP_PX / view.value.scale };
  let result: GestureResult;
  let crop: Partial<ElementCrop> | undefined;
  if (active.kind === 'rotate') {
    result = rotateElement(
      active.start,
      active.parent,
      active.startPointer,
      active.pointer,
      active.shift ? ROTATE_STEP_DEGREES : null,
    );
  } else if (active.kind === 'crop' && active.handle) {
    const cropped = cropElement(
      active.start,
      active.originalCrop,
      active.parent,
      active.handle,
      active.startPointer,
      active.pointer,
      snap,
    );
    result = cropped;
    crop = cropped.crop;
  } else if (active.kind === 'resize' && active.handle) {
    result = resizeElement(active.start, active.parent, active.handle, active.startPointer, active.pointer, {
      keepAspect: active.shift || active.keepAspect,
      snap,
    });
  } else {
    result = moveElement(
      active.start,
      active.parent,
      { x: active.pointer.x - active.startPointer.x, y: active.pointer.y - active.startPointer.y },
      snap,
    );
  }
  store.updateLayer(
    active.sceneId,
    active.elementId,
    crop ? { transform: result.transform, crop } : { transform: result.transform },
  );
  syncStackPreview(active);
  guides.value = result.guides;
}

function scheduleGesture(): void {
  if (pendingFrame === null) {
    pendingFrame = requestAnimationFrame(applyGesture);
  }
}

function finishGesture(cancel: boolean): void {
  const active = gesture;
  if (!active) {
    return;
  }
  if (pendingFrame !== null) {
    cancelAnimationFrame(pendingFrame);
    pendingFrame = null;
  }
  if (cancel) {
    restoreStackOrder(active);
    store.updateLayer(active.sceneId, active.elementId, { transform: active.original, crop: active.originalCrop });
  } else {
    applyGesture();
  }
  gesture = null;
  guides.value = [];
  if (active.kind === 'crop') {
    compositionEngine.previewCrop(null);
  }
  store.endGesture();
  if (root.value?.hasPointerCapture(active.pointerId)) {
    root.value.releasePointerCapture(active.pointerId);
  }
}

/** Live stack preview while moving: sit above the element under the pointer, else restore. */
function syncStackPreview(active: Gesture): void {
  if (active.kind !== 'move' || !active.dragging) {
    return;
  }
  const current = store.activeScene;
  if (!current || current.id !== active.sceneId) {
    return;
  }
  const under = hitTestSceneExcluding(current, active.pointer, active.elementId);
  if (under) {
    if (!drawsAbove(current, active.elementId, under.id)) {
      store.moveElementBlock(active.sceneId, [active.elementId], under.id, 'after');
    }
    return;
  }
  restoreStackOrder(active);
}

function restoreStackOrder(active: Gesture): void {
  if (active.kind !== 'move' || active.originalIndex < 0) {
    return;
  }
  const current = store.activeScene;
  if (!current || current.id !== active.sceneId) {
    return;
  }
  const fromIndex = current.elements.findIndex((element) => element.id === active.elementId);
  if (fromIndex !== -1 && fromIndex !== active.originalIndex) {
    store.moveLayer(active.sceneId, active.elementId, active.originalIndex);
  }
}

/** Last pointer position over the overlay, so Alt can switch the cursor without a move. */
let hoverPoint: Point | null = null;

function refreshHoverCursor(altKey: boolean): void {
  cursor.value = hoverPoint ? cursorFor(zoneAt(hoverPoint, altKey), hoverPoint) : 'default';
}

function onPointerDown(event: PointerEvent): void {
  const current = scene.value;
  if (event.button !== 0 || !current || gesture) {
    return;
  }
  measure();
  const point = toProject(event);
  const zone = zoneAt(point, event.altKey);
  if (!zone) {
    return;
  }
  const target = zone.element;

  event.stopPropagation();
  event.preventDefault();
  if (store.selectedLayerIds.length !== 1 || store.selectedLayerIds[0] !== target.id) {
    store.selectLayer(target.id);
  }
  if (target.locked) {
    return;
  }

  gesture = {
    kind: zone.kind,
    pointerId: event.pointerId,
    sceneId: current.id,
    elementId: target.id,
    original: target.transform,
    originalCrop: target.crop,
    originalIndex: current.elements.findIndex((element) => element.id === target.id),
    start: centreAnchor(target.transform),
    parent: parentAffine(current, target),
    handle: zone.handle,
    keepAspect: keepsAspectRatio(target),
    startPointer: point,
    startClient: { x: event.clientX, y: event.clientY },
    pointer: point,
    shift: event.shiftKey,
    ctrl: event.ctrlKey,
    dragging: false,
  };
  cursor.value = cursorFor(zone, point);
  hoveredId.value = null;
  root.value?.setPointerCapture(event.pointerId);
  store.beginGesture();
  if (zone.kind === 'crop') {
    compositionEngine.previewCrop(target.id);
  }
}

function onPointerMove(event: PointerEvent): void {
  const active = gesture;
  if (!active) {
    const current = scene.value;
    if (!current) {
      return;
    }
    hoverPoint = toProject(event);
    hoveredId.value = hitTestScene(current, hoverPoint)?.id ?? null;
    refreshHoverCursor(event.altKey);
    return;
  }
  if (event.pointerId !== active.pointerId) {
    return;
  }
  active.pointer = toProject(event);
  active.shift = event.shiftKey;
  active.ctrl = event.ctrlKey;
  if (
    !active.dragging &&
    Math.hypot(event.clientX - active.startClient.x, event.clientY - active.startClient.y) >= DRAG_THRESHOLD_PX
  ) {
    active.dragging = true;
  }
  if (active.kind === 'rotate') {
    const element = scene.value?.elements.find((item) => item.id === active.elementId);
    if (element) {
      cursor.value = rotateCursor(angleFromCentre(element, active.pointer));
    }
  }
  scheduleGesture();
}

function onPointerUp(event: PointerEvent): void {
  if (gesture && event.pointerId === gesture.pointerId) {
    finishGesture(false);
    hoverPoint = toProject(event);
    refreshHoverCursor(event.altKey);
  }
}

function onPointerCancel(event: PointerEvent): void {
  if (gesture && event.pointerId === gesture.pointerId) {
    finishGesture(true);
  }
}

function onPointerLeave(): void {
  if (!gesture) {
    hoveredId.value = null;
    hoverPoint = null;
  }
}

function onModifierKey(event: KeyboardEvent): void {
  const active = gesture;
  if (!active) {
    if (event.key === 'Alt' && hoverPoint) {
      event.preventDefault();
      refreshHoverCursor(event.type === 'keydown');
    }
    return;
  }
  if (event.key === 'Escape' && event.type === 'keydown') {
    event.preventDefault();
    finishGesture(true);
    return;
  }
  if (event.key === 'Alt') {
    event.preventDefault();
  }
  if (active.shift !== event.shiftKey || active.ctrl !== event.ctrlKey) {
    active.shift = event.shiftKey;
    active.ctrl = event.ctrlKey;
    scheduleGesture();
  }
}

let resizeObserver: ResizeObserver | null = null;

watch(
  () => [root.value, props.host] as const,
  ([overlay, host]) => {
    resizeObserver?.disconnect();
    if (!overlay || !host || typeof ResizeObserver === 'undefined') {
      return;
    }
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(overlay);
    resizeObserver.observe(host);
    measure();
  },
);
watch(composition, measure);

watch(
  () => scene.value?.id,
  () => {
    finishGesture(true);
    hoveredId.value = null;
  },
);

onMounted(() => {
  window.addEventListener('keydown', onModifierKey);
  window.addEventListener('keyup', onModifierKey);
});

onBeforeUnmount(() => {
  finishGesture(true);
  resizeObserver?.disconnect();
  window.removeEventListener('keydown', onModifierKey);
  window.removeEventListener('keyup', onModifierKey);
});
</script>

<template>
  <div
    ref="root"
    class="absolute inset-0 touch-none select-none"
    :style="{ cursor }"
    data-scene-transform-overlay
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @pointerleave="onPointerLeave"
  >
    <svg class="pointer-events-none absolute inset-0 size-full overflow-visible">
      <polygon
        v-if="hovered"
        :points="outlinePoints(hovered)"
        class="text-accent"
        fill="none"
        stroke="currentColor"
        stroke-opacity="0.45"
        stroke-width="1"
      />
      <polygon
        v-for="element in selected"
        :key="element.id"
        :points="outlinePoints(element)"
        class="text-accent"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        :stroke-dasharray="element.locked ? '4 3' : undefined"
      />
      <line
        v-for="(line, index) in guideLines"
        :key="index"
        v-bind="line"
        class="text-accent"
        stroke="currentColor"
        stroke-width="1"
        stroke-dasharray="6 4"
      />
      <circle
        v-for="handle in handles"
        :key="handle.id"
        :cx="handle.x"
        :cy="handle.y"
        :r="HANDLE_RADIUS_PX"
        class="fill-on-surface stroke-surface"
        stroke-width="1.5"
      />
    </svg>
  </div>
</template>
