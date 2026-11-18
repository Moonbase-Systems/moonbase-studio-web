import { Application, BlurFilter, Container, Graphics, RenderTexture, Sprite, Texture } from 'pixi.js';

import type { Size } from './composition-geometry';

export type OutputBenchmarkCase = {
  name: string;
  width: number;
  height: number;
  viewport: Size;
  sprites: number;
  filter: boolean;
};

export type OutputBenchmarkSample = {
  name: string;
  frameMs: number[];
  medianMs: number;
  gpuMemoryBytes: number | null;
};

const VIEWPORTS = {
  small: { width: 640, height: 360 },
  large: { width: 1600, height: 900 },
} as const;

const RESOLUTIONS = [
  { name: '720p', width: 1280, height: 720 },
  { name: '1080p', width: 1920, height: 1080 },
  { name: '1440p', width: 2560, height: 1440 },
  { name: '4k', width: 3840, height: 2160 },
] as const;

/** Cases the dev page measures. Numbers come from a browser run, not from this list. */
export const outputBenchmarkCases = (): OutputBenchmarkCase[] => {
  const cases: OutputBenchmarkCase[] = [];
  for (const resolution of RESOLUTIONS) {
    for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
      cases.push({
        name: `${resolution.name} small-scene ${viewportName}`,
        width: resolution.width,
        height: resolution.height,
        viewport,
        sprites: 4,
        filter: false,
      });
    }
  }
  const fullHd = RESOLUTIONS[1];
  if (!fullHd) {
    return cases;
  }
  cases.push({
    name: '1080p many-sprites small',
    width: fullHd.width,
    height: fullHd.height,
    viewport: VIEWPORTS.small,
    sprites: 200,
    filter: false,
  });
  cases.push({
    name: '1080p one-filter large',
    width: fullHd.width,
    height: fullHd.height,
    viewport: VIEWPORTS.large,
    sprites: 4,
    filter: true,
  });
  return cases;
};

export const median = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const left = sorted[middle - 1];
  const right = sorted[middle];
  if (sorted.length % 2 === 0 && left !== undefined && right !== undefined) {
    return (left + right) / 2;
  }
  return right ?? 0;
};

const gpuMemory = (): number | null => {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
  return typeof memory?.usedJSHeapSize === 'number' ? memory.usedJSHeapSize : null;
};

/**
 * Times one RenderTexture pass per case. The preview canvas stays at the viewport size.
 * GPU memory is reported only when the browser exposes it.
 */
export const runOutputFrameBenchmark = async (frames = 8): Promise<OutputBenchmarkSample[]> => {
  const host = document.createElement('div');
  host.style.width = '1600px';
  host.style.height = '900px';
  document.body.appendChild(host);
  const app = new Application();
  await app.init({
    width: 640,
    height: 360,
    backgroundAlpha: 0,
    autoStart: false,
    preference: 'webgl',
  });
  host.appendChild(app.canvas);
  const results: OutputBenchmarkSample[] = [];
  try {
    for (const item of outputBenchmarkCases()) {
      app.renderer.resize(item.viewport.width, item.viewport.height, 1);
      const stage = new Container();
      const texture = Texture.WHITE;
      for (let index = 0; index < item.sprites; index += 1) {
        const sprite = new Sprite(texture);
        sprite.position.set((index * 17) % item.width, (index * 13) % item.height);
        sprite.setSize(64, 64);
        stage.addChild(sprite);
      }
      stage.addChild(new Graphics().rect(0, 0, item.width, item.height).stroke({ width: 2, color: 0xffffff }));
      if (item.filter) {
        stage.filters = [new BlurFilter({ strength: 4 })];
      }
      const target = RenderTexture.create({ width: item.width, height: item.height, resolution: 1 });
      const samples: number[] = [];
      for (let frame = 0; frame < frames + 2; frame += 1) {
        const started = performance.now();
        app.renderer.render({ container: stage, target, clear: true });
        app.renderer.extract.canvas({ target });
        const elapsed = performance.now() - started;
        if (frame >= 2) {
          samples.push(elapsed);
        }
      }
      results.push({
        name: item.name,
        frameMs: samples.map((sample) => Math.round(sample * 100) / 100),
        medianMs: Math.round(median(samples) * 100) / 100,
        gpuMemoryBytes: gpuMemory(),
      });
      target.destroy(true);
      stage.destroy({ children: true });
    }
  } finally {
    app.destroy({ removeView: true }, { children: true });
    host.remove();
  }
  return results;
};
