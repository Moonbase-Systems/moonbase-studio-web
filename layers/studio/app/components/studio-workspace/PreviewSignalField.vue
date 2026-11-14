<script setup lang="ts">
import { letterboxComposition, type Size } from '../../infrastructure/pixi/composition-geometry';
import { useStudioSessionStore } from '../../store/studio-session.store';
import { projectPointCovered, type SignalCover, signalCovers } from './preview-signal-covers';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const store = useStudioSessionStore();

let raf = 0;
let running = false;
let lastTime = 0;
let reducedMotion = false;
let dragging = false;
let pointer: { x: number; y: number } | null = null;
let resizeObserver: ResizeObserver | null = null;
let listenTarget: HTMLElement | null = null;

let covers: SignalCover[] = [];
/** Covers that swallow dots. A drag keeps the previous set until the element is released. */
let settledCovers: SignalCover[] = [];
let composition: Size = { width: 1920, height: 1080 };
let letter = { scale: 1, offsetX: 0, offsetY: 0 };

const SIGNAL = '34, 255, 134';
const DOT = 2;
const AREA_PER_POINT = 900;
const MAX_POINTS = 160;
const NEIGHBOR = 36;
const POINTER_RADIUS = 96;
const POINTER_PUSH = 110;
const PULSE_THRESHOLD = 0.45;
const PULSE_DECAY = 0.9;

type Point = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pulse: number;
};

const points: Point[] = [];

function pointCount(width: number, height: number) {
  return Math.min(MAX_POINTS, Math.max(0, Math.round((width * height) / AREA_PER_POINT)));
}

function makePoint(width: number, height: number): Point {
  const angle = Math.random() * Math.PI * 2;
  const speed = reducedMotion ? 0 : 6 + Math.random() * 8;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    pulse: 0,
  };
}

function onCanvas(point: Point, width: number, height: number) {
  return point.x >= 0 && point.y >= 0 && point.x <= width && point.y <= height;
}

function pointerStrength(point: Point) {
  if (!pointer) {
    return 0;
  }
  const distance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
  if (distance >= POINTER_RADIUS || distance < 0.001) {
    return 0;
  }
  return 1 - distance / POINTER_RADIUS;
}

function refreshCovers(width: number, height: number) {
  composition = store.project?.settings.video ?? composition;
  letter = letterboxComposition(composition, { width, height });
  covers = signalCovers(store.activeScene, store.project);
  if (!dragging) {
    settledCovers = covers;
  }
}

function coveredAt(x: number, y: number, active: SignalCover[]) {
  if (active.length === 0 || !(letter.scale > 0)) {
    return false;
  }
  return projectPointCovered(active, composition, {
    x: (x - letter.offsetX) / letter.scale,
    y: (y - letter.offsetY) / letter.scale,
  });
}

/** Share of the preview that is still open. Settled covers, so a drag does not shrink it. */
function openFraction(width: number, height: number) {
  if (settledCovers.length === 0) {
    return 1;
  }
  const columns = 8;
  const rows = 8;
  let open = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = ((column + 0.5) / columns) * width;
      const y = ((row + 0.5) / rows) * height;
      if (!coveredAt(x, y, settledCovers)) {
        open += 1;
      }
    }
  }
  return open / (columns * rows);
}

/**
 * Dots that leave the preview stay gone. Dots that drift behind a settled layer
 * disappear too, but only once that layer has been released.
 */
function prune(width: number, height: number) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index]!;
    if (!onCanvas(point, width, height)) {
      points.splice(index, 1);
      continue;
    }
    if (!dragging && coveredAt(point.x, point.y, settledCovers)) {
      points.splice(index, 1);
    }
  }
}

function replenish(width: number, height: number) {
  const target = Math.round(pointCount(width, height) * openFraction(width, height));
  const budget = points.length === 0 ? target : 2;
  let spawned = 0;
  let tries = 0;
  while (points.length < target && spawned < budget && tries < target + 8) {
    tries += 1;
    const point = makePoint(width, height);
    if (coveredAt(point.x, point.y, settledCovers)) {
      continue;
    }
    points.push(point);
    spawned += 1;
  }
}

function react(dt: number, width: number, height: number) {
  for (const point of points) {
    point.x += point.vx * dt;
    point.y += point.vy * dt;
    point.pulse = Math.max(0, point.pulse - PULSE_DECAY * dt);
  }

  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const a = points[i]!;
      const b = points[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= NEIGHBOR || distance < 0.001) {
        continue;
      }
      const nx = dx / distance;
      const ny = dy / distance;
      const nudge = Math.min((NEIGHBOR - distance) * 12, 10) * dt;
      a.x -= nx * nudge;
      a.y -= ny * nudge;
      b.x += nx * nudge;
      b.y += ny * nudge;
      const flash = 0.55 + (1 - distance / NEIGHBOR) * 0.45;
      a.pulse = Math.max(a.pulse, flash);
      b.pulse = Math.max(b.pulse, flash);
    }
  }

  if (pointer) {
    for (const point of points) {
      const dx = point.x - pointer.x;
      const dy = point.y - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (distance < POINTER_RADIUS && distance >= 0.001) {
        const strength = 1 - distance / POINTER_RADIUS;
        const nx = dx / distance;
        const ny = dy / distance;
        point.x += nx * POINTER_PUSH * strength * dt;
        point.y += ny * POINTER_PUSH * strength * dt;
        point.pulse = Math.max(point.pulse, 0.55 + strength * 0.45);
      }
    }
  }
  prune(width, height);
  replenish(width, height);
}

function prepare(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.floor(width * dpr);
  const pixelHeight = Math.floor(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
}

function draw() {
  const canvas = canvasRef.value;
  const context = canvas?.getContext('2d');
  if (!canvas || !context) {
    return;
  }
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width <= 0 || height <= 0) {
    return;
  }
  prepare(context, canvas, width, height);

  const half = DOT / 2;
  const dim: Point[] = [];
  const bright: Point[] = [];
  for (const point of points) {
    if (!onCanvas(point, width, height)) {
      continue;
    }
    const lit = point.pulse > PULSE_THRESHOLD || pointerStrength(point) > 0.35;
    (lit ? bright : dim).push(point);
  }
  context.fillStyle = `rgba(${SIGNAL}, 0.28)`;
  for (const point of dim) {
    context.fillRect(point.x - half, point.y - half, DOT, DOT);
  }
  context.fillStyle = `rgba(${SIGNAL}, 0.7)`;
  for (const point of bright) {
    context.fillRect(point.x - half, point.y - half, DOT, DOT);
  }
}

function stopLoop() {
  running = false;
  window.cancelAnimationFrame(raf);
  raf = 0;
}

function frame(time: number) {
  if (!running) {
    return;
  }
  const dt = lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  const canvas = canvasRef.value;
  const width = canvas?.clientWidth ?? 0;
  const height = canvas?.clientHeight ?? 0;
  if (!document.hidden && width > 0 && height > 0) {
    refreshCovers(width, height);
    if (!reducedMotion) {
      react(dt, width, height);
    } else {
      prune(width, height);
    }
    draw();
  }
  raf = window.requestAnimationFrame(frame);
}

function startLoop() {
  if (running || reducedMotion) {
    return;
  }
  running = true;
  lastTime = 0;
  raf = window.requestAnimationFrame(frame);
}

function syncActivity() {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width <= 0 || height <= 0) {
    return;
  }
  refreshCovers(width, height);
  prune(width, height);
  replenish(width, height);
  if (reducedMotion) {
    stopLoop();
    draw();
    return;
  }
  startLoop();
}

function onPointerMove(event: PointerEvent) {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  pointer = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height ? { x, y } : null;
  if (reducedMotion) {
    syncActivity();
  }
}

function onPointerLeave() {
  pointer = null;
  if (reducedMotion) {
    syncActivity();
  }
}

function onPointerDown() {
  dragging = true;
}

function onPointerUp() {
  if (!dragging) {
    return;
  }
  dragging = false;
  syncActivity();
}

watch(
  () => store.activeScene,
  () => syncActivity(),
  { deep: true },
);
watch(
  () => store.project?.settings.video,
  () => syncActivity(),
  { deep: true },
);

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = canvasRef.value;
  listenTarget = canvas?.parentElement ?? null;
  listenTarget?.addEventListener('pointermove', onPointerMove);
  listenTarget?.addEventListener('pointerleave', onPointerLeave);
  listenTarget?.addEventListener('pointerdown', onPointerDown, true);
  listenTarget?.addEventListener('pointerup', onPointerUp);
  listenTarget?.addEventListener('pointercancel', onPointerUp);
  if (canvas && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => syncActivity());
    resizeObserver.observe(canvas);
  }
  syncActivity();
});

onUnmounted(() => {
  stopLoop();
  resizeObserver?.disconnect();
  listenTarget?.removeEventListener('pointermove', onPointerMove);
  listenTarget?.removeEventListener('pointerleave', onPointerLeave);
  listenTarget?.removeEventListener('pointerdown', onPointerDown, true);
  listenTarget?.removeEventListener('pointerup', onPointerUp);
  listenTarget?.removeEventListener('pointercancel', onPointerUp);
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="pointer-events-none absolute inset-0 size-full"
    aria-hidden="true"
  />
</template>
