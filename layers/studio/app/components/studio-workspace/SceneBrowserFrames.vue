<script setup lang="ts">
import { letterboxComposition } from '../../infrastructure/pixi/composition-geometry';
import { outputFrame } from '../../models/output-profile.domain';
import { type Affine, elementAffine, elementsInDrawOrder, multiplyAffine } from '../../playback/scene-element-gesture';
import {
  browserCropPlacement,
  browserLayoutSize,
  browserLayoutZoom,
  browserPageViewport,
  resolveBrowserPageUrl,
} from '../../schemas/browser-source.schema';
import { useStudioSessionStore } from '../../store/studio-session.store';

const props = defineProps<{
  /** Element the composition canvas fills; the project frame is letterboxed inside it. */
  host: HTMLElement | null;
}>();

const store = useStudioSessionStore();
const root = ref<HTMLDivElement | null>(null);

type View = { originX: number; originY: number; scale: number };
const view = ref<View>({ originX: 0, originY: 0, scale: 1 });

const composition = computed(() => outputFrame(store.project));

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

const screenMatrix = (affine: Affine, current: View): string =>
  `matrix(${affine.a * current.scale}, ${affine.b * current.scale}, ${affine.c * current.scale}, ${affine.d * current.scale}, ${current.originX + affine.tx * current.scale}, ${current.originY + affine.ty * current.scale})`;

const frames = computed(() => {
  const scene = store.activeScene;
  const project = store.project;
  if (!scene || !project) {
    return [];
  }
  const current = view.value;
  const drawn = [];
  for (const element of elementsInDrawOrder(scene)) {
    if (element.type !== 'browser' || !element.visibility) {
      continue;
    }
    const source = project.sources.find((item) => item.id === element.sourceId);
    if (!source || source.type !== 'browser' || !(source.width > 0) || !(source.height > 0)) {
      continue;
    }
    const src = resolveBrowserPageUrl(source.url);
    if (!src) {
      continue;
    }
    const box = element.transform;
    const viewport = browserPageViewport(source, outputFrame(project));
    const layout = browserLayoutSize(viewport.width, viewport.height, browserLayoutZoom(source));
    const placement = browserCropPlacement(box, layout, element.crop);
    const fx = box.flipX ? -1 : 1;
    const fy = box.flipY ? -1 : 1;
    const flip: Affine = {
      a: fx,
      b: 0,
      c: 0,
      d: fy,
      tx: (box.width / 2) * (1 - fx),
      ty: (box.height / 2) * (1 - fy),
    };
    drawn.push({
      id: element.id,
      name: element.name,
      src,
      boxWidth: box.width,
      boxHeight: box.height,
      pageWidth: layout.width,
      pageHeight: layout.height,
      opacity: element.appearance.opacity,
      boxTransform: screenMatrix(multiplyAffine(elementAffine(scene, element), flip), current),
      pageTransform: `matrix(${placement.a}, 0, 0, ${placement.d}, ${placement.tx}, ${placement.ty})`,
    });
  }
  return drawn;
});

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

onScopeDispose(() => {
  resizeObserver?.disconnect();
});

/** Persists the project-frame viewport for an external overlay that is still on the 500×500 default. */
function adoptExternalCanvases(): void {
  const project = store.project;
  if (!project) {
    return;
  }
  for (const source of project.sources) {
    if (source.type !== 'browser') {
      continue;
    }
    const viewport = browserPageViewport(source, outputFrame(project));
    if (viewport.width === source.width && viewport.height === source.height) {
      continue;
    }
    store.updateBrowserSource(source.id, { url: source.url });
  }
}

onMounted(adoptExternalCanvases);
watch(() => store.project?.sources, adoptExternalCanvases);
</script>

<template>
  <div
    ref="root"
    class="pointer-events-none absolute inset-0 overflow-hidden"
    data-scene-browser-frames
  >
    <div
      v-for="frame in frames"
      :key="frame.id"
      class="pointer-events-none absolute left-0 top-0 overflow-hidden"
      :style="{
        width: `${frame.boxWidth}px`,
        height: `${frame.boxHeight}px`,
        transformOrigin: '0 0',
        transform: frame.boxTransform,
        opacity: frame.opacity,
      }"
    >
      <div
        class="pointer-events-none absolute left-0 top-0"
        :style="{
          width: `${frame.pageWidth}px`,
          height: `${frame.pageHeight}px`,
          transformOrigin: '0 0',
          transform: frame.pageTransform,
        }"
      >
        <iframe
          :key="`${frame.id}:${frame.src}`"
          :src="frame.src"
          :title="frame.name"
          allow="autoplay"
          class="pointer-events-none absolute left-0 top-0 border-0 bg-transparent"
          :style="{ width: `${frame.pageWidth}px`, height: `${frame.pageHeight}px` }"
        />
      </div>
    </div>
  </div>
</template>
