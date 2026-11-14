<script setup lang="ts">
import { useCompositionEngine } from '../../composables/useCompositionEngine';
import type { Transform2D } from '../../models/common.domain';
import type { AssetId, ElementId, SourceId } from '../../models/ids.domain';
import type { ProjectVideoSettings } from '../../models/project.domain';
import { createEmptyScene, type Scene } from '../../models/scene.domain';
import type {
  BrowserElement,
  ImageElement,
  SceneElement,
  ShapeElement,
  TextElement,
} from '../../models/scene-element.domain';
import {
  createDefaultImageElementSettings,
  createDefaultShapeElementSettings,
  createDefaultTextElementSettings,
  type ImageElementSettings,
  type ShapeElementSettings,
  type TextElementSettings,
} from '../../models/scene-elements';
import { createSceneElementBaseFields } from '../../models/scene-elements/scene-element-base.domain';
import { createSceneGroup } from '../../models/scene-group.domain';
import type { CompositionEngineError } from '../../ports/composition-engine';
import type { PortResult } from '../../ports/result';

definePageMeta({
  title: 'nav.app',
});

/*
 * In-memory scenes only: nothing here touches the session store, IndexedDB or a user project.
 */

const video: ProjectVideoSettings = { width: 1920, height: 1080, frameRate: 30 };
const STEP_DELAY_MS = 900;

const SHAPE_SOURCE: SourceId = 'demo-source-shape';
const TEXT_SOURCE: SourceId = 'demo-source-text';
const BROWSER_SOURCE: SourceId = 'demo-source-browser';
const BADGE_SOURCE: SourceId = 'demo-source-badge';
const MISSING_SOURCE: SourceId = 'demo-source-missing';
const BADGE_ASSET: AssetId = 'demo-asset-badge';
const MISSING_ASSET: AssetId = 'demo-asset-missing';

const TITLE_ID: ElementId = 'a-title';
const LEFT_BADGE_ID: ElementId = 'a-badge-left';

const sourceAssets = new Map<SourceId, AssetId>([
  [BADGE_SOURCE, BADGE_ASSET],
  [MISSING_SOURCE, MISSING_ASSET],
]);
const assetUrls = new Map<AssetId, string>();

const scenes = shallowRef<Scene[]>([]);

const engine = useCompositionEngine({
  getCompositionSize: () => video,
  getRetainedSceneIds: () => scenes.value.map((scene) => scene.id),
  resolveSourceAssetId: (sourceId) => sourceAssets.get(sourceId) ?? null,
  resolveAssetUrl: (assetId) => assetUrls.get(assetId) ?? null,
  resolveScreenStream: () => null,
});
const { host, isReady, diagnostics } = engine;

const base = (id: ElementId, name: string, transform: Partial<Transform2D>) =>
  createSceneElementBaseFields({ id, name, video, transform });

const shape = (
  id: ElementId,
  transform: Partial<Transform2D>,
  settings: Partial<ShapeElementSettings>,
): ShapeElement => ({
  ...base(id, id, transform),
  type: 'shape',
  sourceId: SHAPE_SOURCE,
  settings: { ...createDefaultShapeElementSettings(), ...settings },
});

const text = (id: ElementId, transform: Partial<Transform2D>, settings: Partial<TextElementSettings>): TextElement => ({
  ...base(id, id, transform),
  type: 'text',
  sourceId: TEXT_SOURCE,
  settings: { ...createDefaultTextElementSettings(), ...settings },
});

const image = (
  id: ElementId,
  sourceId: SourceId,
  transform: Partial<Transform2D>,
  settings: Partial<ImageElementSettings> = {},
): ImageElement => ({
  ...base(id, id, transform),
  type: 'image',
  sourceId,
  settings: { ...createDefaultImageElementSettings(), ...settings },
});

const browser = (id: ElementId, transform: Partial<Transform2D>): BrowserElement => ({
  ...base(id, 'Browser source', transform),
  type: 'browser',
  sourceId: BROWSER_SOURCE,
  settings: {},
});

const buildSceneA = (): Scene => {
  const created = createSceneGroup({ id: 'a-group', name: 'Shapes', elementIds: ['a-gradient', 'a-ellipse'], video });
  const group = { ...created, transform: { ...created.transform, rotation: -4, anchorX: 0.5, anchorY: 0.5 } };

  const grouped = (element: SceneElement): SceneElement => ({ ...element, parentGroupId: group.id });

  return {
    ...createEmptyScene({ id: 'demo-scene-a', name: 'Scene A' }),
    background: { kind: 'color', color: '#0f172a' },
    groups: [group],
    elements: [
      shape(
        'a-panel',
        { x: 80, y: 80, width: 1760, height: 920 },
        { fillColor: '#1e293b', cornerRadius: 32, strokeColor: '#334155', strokeWidth: 4 },
      ),
      grouped(
        shape(
          'a-gradient',
          { x: 160, y: 180, width: 560, height: 320 },
          {
            cornerRadius: 24,
            gradient: {
              type: 'linear',
              angle: 30,
              stops: [
                { offset: 0, color: '#3b82f6' },
                { offset: 1, color: '#8b5cf6' },
              ],
            },
          },
        ),
      ),
      grouped(
        shape(
          'a-ellipse',
          { x: 560, y: 400, width: 240, height: 240 },
          { shapeType: 'ellipse', fillColor: '#f59e0b', fillOpacity: 0.9 },
        ),
      ),
      text(
        TITLE_ID,
        { x: 900, y: 180, width: 900, height: 140 },
        { text: 'MoonBase × PixiJS', fontSize: 88, fontWeight: 700, color: '#f8fafc' },
      ),
      text(
        'a-subtitle',
        { x: 900, y: 320, width: 900, height: 160 },
        {
          text: 'Scene A: shapes, a rotated group, text and one image shared by two layers.',
          fontSize: 36,
          color: '#94a3b8',
        },
      ),
      image(
        LEFT_BADGE_ID,
        BADGE_SOURCE,
        { x: 900, y: 580, width: 256, height: 256, rotation: -8, anchorX: 0.5, anchorY: 0.5 },
        { cornerRadius: 32 },
      ),
      image('a-badge-right', BADGE_SOURCE, { x: 1200, y: 580, width: 256, height: 256, flipX: true }),
      image('a-missing', MISSING_SOURCE, { x: 1500, y: 580, width: 256, height: 256 }),
    ],
  };
};

const buildSceneB = (): Scene => ({
  ...createEmptyScene({ id: 'demo-scene-b', name: 'Scene B' }),
  background: { kind: 'color', color: '#1e1b4b' },
  elements: [
    text(
      'b-title',
      { x: 0, y: 300, width: 1920, height: 240 },
      {
        text: 'Scene B',
        fontSize: 160,
        fontWeight: 800,
        textAlign: 'center',
        verticalAlign: 'middle',
        shadow: { color: '#000000', offsetX: 0, offsetY: 8, blur: 12, opacity: 0.6 },
      },
    ),
    shape('b-triangle', { x: 360, y: 520, width: 160, height: 140 }, { shapeType: 'triangle', fillColor: '#a78bfa' }),
    text(
      'b-caption',
      { x: 360, y: 640, width: 900, height: 80 },
      {
        text: 'Underlined caption with one line and an ellipsis when the text does not fit into the box',
        fontSize: 40,
        color: '#c4b5fd',
        underline: true,
        maxLines: 1,
        overflow: 'ellipsis',
      },
    ),
    browser('b-browser', { x: 1380, y: 720, width: 440, height: 260 }),
  ],
});

const withTransform = (scene: Scene, elementId: ElementId, patch: Partial<Transform2D>): Scene => ({
  ...scene,
  elements: scene.elements.map((element) =>
    element.id === elementId ? { ...element, transform: { ...element.transform, ...patch } } : element,
  ),
});

const withoutElement = (scene: Scene, elementId: ElementId): Scene => ({
  ...scene,
  elements: scene.elements.filter((element) => element.id !== elementId),
  groups: scene.groups.map((group) => ({
    ...group,
    elementIds: group.elementIds.filter((id) => id !== elementId),
  })),
});

const createBadgeDataUrl = (): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('2D canvas is not available for the demo image');
  }
  const gradient = context.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, '#22d3ee');
  gradient.addColorStop(1, '#6366f1');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);
  context.fillStyle = '#ffffff';
  context.font = 'bold 96px sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText('MB', 28, 128);
  return canvas.toDataURL('image/png');
};

type StepLog = { label: string; ok: boolean; detail: string };

const steps = ref<StepLog[]>([]);
const running = ref(false);

const describeError = (error: CompositionEngineError): string =>
  error.kind === 'not-initialized' ? 'not-initialized' : `${error.kind}: ${error.message}`;

const canvasCount = (): number => host.value?.querySelectorAll('canvas').length ?? 0;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

async function step(label: string, run: () => Promise<PortResult<void, CompositionEngineError>>): Promise<boolean> {
  const result = await run();
  steps.value = [
    ...steps.value,
    {
      label,
      ok: result.ok,
      detail: result.ok ? `canvas in host: ${canvasCount()}` : describeError(result.error),
    },
  ];
  await wait(STEP_DELAY_MS);
  return result.ok;
}

async function runSequence() {
  if (running.value) {
    return;
  }
  running.value = true;
  steps.value = [];

  const sceneA = buildSceneA();
  const sceneB = buildSceneB();
  scenes.value = [sceneA, sceneB];

  try {
    if (!(await step('1. Initialize PixiJS', () => engine.initialize()))) {
      return;
    }
    await step('2–4. Render scene A: shapes, group, text, shared image, missing image', () => engine.render(sceneA));

    const moved = withTransform(sceneA, TITLE_ID, { x: 160, y: 760 });
    scenes.value = [moved, sceneB];
    await step('5. Move the title on scene A', () => engine.render(moved));

    await step('6. Switch the active scene to B', () => engine.render(sceneB));

    const trimmed = withoutElement(moved, LEFT_BADGE_ID);
    scenes.value = [trimmed, sceneB];
    await step('7. Back to A and remove one image layer; the other copy keeps the shared texture', () =>
      engine.render(trimmed),
    );
  } finally {
    running.value = false;
  }
}

async function showScene(index: number) {
  const scene = scenes.value[index];
  if (!scene) {
    return;
  }
  await step(`Show ${scene.name}`, () => engine.render(scene));
}

async function destroyEngine() {
  await step('8. Dispose the engine', () => engine.dispose());
}

async function restart() {
  await engine.dispose();
  await runSequence();
}

onMounted(() => {
  assetUrls.set(BADGE_ASSET, createBadgeDataUrl());
  assetUrls.set(MISSING_ASSET, '/__composition-demo-missing.png');
  void runSequence();
});
</script>

<template>
  <div class="bg-surface px-x-lg py-x-lg text-on-surface min-h-screen font-sans">
    <div class="gap-x-lg mx-auto flex max-w-[64rem] flex-col">
      <header class="gap-sm flex flex-col">
        <h2 class="text-body-md text-accent font-normal">CompositionEngine — PixiJS adapter demo</h2>
        <p class="text-body-sm text-on-surface-dim">
          Scenes live in memory on this page. The studio session and saved projects are not touched.
        </p>
      </header>

      <div
        class="bg-surface-container-high border-line relative w-full overflow-hidden border"
        style="aspect-ratio: 16 / 9"
      >
        <div
          ref="host"
          class="absolute inset-0"
          data-composition-host
        />
        <span
          v-if="!isReady"
          class="text-body-sm text-on-surface-dim pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          Engine disposed
        </span>
      </div>

      <div class="gap-md flex flex-wrap items-center">
        <BaseTextButton
          text="Run sequence again"
          :disabled="running"
          @click="restart"
        />
        <BaseTextButton
          text="Show scene A"
          :disabled="running || !isReady"
          @click="showScene(0)"
        />
        <BaseTextButton
          text="Show scene B"
          :disabled="running || !isReady"
          @click="showScene(1)"
        />
        <BaseTextButton
          text="Dispose engine"
          :disabled="running || !isReady"
          @click="destroyEngine"
        />
      </div>

      <section class="gap-sm flex flex-col">
        <h3 class="text-body-sm font-normal">Steps</h3>
        <ol
          class="gap-x-sm flex flex-col"
          data-demo-steps
        >
          <li
            v-for="(entry, index) in steps"
            :key="index"
            class="text-body-sm flex flex-wrap gap-x-2"
          >
            <span :class="entry.ok ? 'text-accent' : 'text-on-surface'">{{ entry.ok ? 'ok' : 'failed' }}</span>
            <span>{{ entry.label }}</span>
            <span class="text-on-surface-dim">{{ entry.detail }}</span>
          </li>
        </ol>
      </section>

      <section class="gap-sm flex flex-col">
        <h3 class="text-body-sm font-normal">Diagnostics</h3>
        <p
          v-if="diagnostics.length === 0"
          class="text-body-sm text-on-surface-dim"
        >
          None
        </p>
        <ul
          v-else
          class="gap-x-sm flex flex-col"
          data-demo-diagnostics
        >
          <li
            v-for="(entry, index) in diagnostics"
            :key="index"
            class="text-body-sm text-on-surface-dim"
          >
            {{ describeError(entry) }}
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
