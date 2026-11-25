import type { InjectionKey, Ref } from 'vue';

import { peekCameraPreviewStream } from '../components/properties-inspector/camera-preview-stream';
import { peekScreenPreviewStream } from '../components/properties-inspector/screen-preview-stream';
import { sessionUrlForAsset } from '../infrastructure/assets/asset-session';
import type { PixiCompositionEngineOptions } from '../infrastructure/pixi/pixi-composition-engine';
import type { ElementId } from '../models/ids.domain';
import { outputFrame } from '../models/output-profile.domain';
import type { Scene } from '../models/scene.domain';
import type { CompositionEngine, CompositionEngineError, FrameDelivery } from '../ports/composition-engine';
import { portErr, portOk, type PortResult } from '../ports/result';
import { useStudioSessionStore } from '../store/studio-session.store';
import { useScreenCaptureQuality } from './useScreenCaptureQuality';
import { useScreenLayerFraming } from './useScreenLayerFraming';

type EngineResult = PortResult<void, CompositionEngineError>;

export type CompositionEngineEnvironment = Omit<PixiCompositionEngineOptions, 'getHost' | 'onDiagnostic'>;

export type CompositionEngineHandle = {
  /** Element the canvas is mounted into; bind it with a template ref. */
  host: Ref<HTMLElement | null>;
  isReady: Readonly<Ref<boolean>>;
  /** Last failed initialize, render or resize; cleared by the next success. */
  lastError: Readonly<Ref<CompositionEngineError | null>>;
  /** Non-fatal problems reported while rendering (texture loads, broken references). */
  diagnostics: Readonly<Ref<readonly CompositionEngineError[]>>;
  initialize(): Promise<EngineResult>;
  render(scene: Scene): Promise<EngineResult>;
  /** Faintly shows the cropped-away picture of one element while its crop is dragged; null hides it. */
  previewCrop(elementId: ElementId | null): void;
  getOutputCanvas(): HTMLCanvasElement | null;
  setOutputCaptureActive(active: boolean): void;
  readFrameDelivery(): FrameDelivery;
  dispose(): Promise<EngineResult>;
};

const MAX_DIAGNOSTICS = 20;

/**
 * Owns one CompositionEngine for the calling component and disposes it on unmount.
 * PixiJS is loaded lazily on the client, so SSR never touches the renderer.
 */
export function useCompositionEngine(environment: CompositionEngineEnvironment): CompositionEngineHandle {
  const host = shallowRef<HTMLElement | null>(null);
  const isReady = ref(false);
  const lastError = shallowRef<CompositionEngineError | null>(null);
  const diagnostics = shallowRef<readonly CompositionEngineError[]>([]);

  let engine: CompositionEngine | null = null;
  let resizeObserver: ResizeObserver | null = null;
  /** Bumped by dispose so an initialize that was in flight does not mark a torn-down engine ready. */
  let generation = 0;

  const record = (result: EngineResult): EngineResult => {
    lastError.value = result.ok ? null : result.error;
    // 'not-initialized' is an expected race (render before init, init after dispose), not a fault.
    if (!result.ok && result.error.kind !== 'not-initialized') {
      console.error('[studio] Composition engine error:', result.error);
    }
    return result;
  };

  const observeHost = (target: HTMLElement): void => {
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1]?.contentRect;
      if (!engine?.resize || !rect || rect.width <= 0 || rect.height <= 0) {
        return;
      }
      void engine.resize({ width: Math.round(rect.width), height: Math.round(rect.height) }).then(record);
    });
    resizeObserver.observe(target);
  };

  async function initialize(): Promise<EngineResult> {
    if (!import.meta.client) {
      return record(portErr({ kind: 'io', message: 'The composition engine runs only in the browser' }));
    }
    const token = generation;

    if (!engine) {
      const { createPixiCompositionEngine } = await import('../infrastructure/pixi/pixi-composition-engine');
      engine ??= createPixiCompositionEngine({
        ...environment,
        getHost: () => host.value,
        onDiagnostic: (error) => {
          console.warn('[studio] Composition engine diagnostic:', error);
          diagnostics.value = [...diagnostics.value.slice(-(MAX_DIAGNOSTICS - 1)), error];
        },
      });
    }

    const result = await engine.initialize();
    if (token !== generation) {
      return record(portErr({ kind: 'not-initialized' }));
    }
    if (result.ok && host.value) {
      observeHost(host.value);
      isReady.value = true;
    }
    return record(result);
  }

  async function render(scene: Scene): Promise<EngineResult> {
    if (!engine || !isReady.value) {
      return record(portErr({ kind: 'not-initialized' }));
    }
    return record(await engine.render(scene));
  }

  function previewCrop(elementId: ElementId | null): void {
    engine?.previewCrop?.(elementId);
  }

  function getOutputCanvas(): HTMLCanvasElement | null {
    return engine?.getOutputCanvas() ?? null;
  }

  function setOutputCaptureActive(active: boolean): void {
    engine?.setOutputCaptureActive(active);
  }

  function readFrameDelivery(): FrameDelivery {
    return (
      engine?.readFrameDelivery() ?? {
        deliveredFrames: 0,
        firstDeliveredAt: null,
        lastDeliveredAt: null,
        width: 0,
        height: 0,
      }
    );
  }

  async function dispose(): Promise<EngineResult> {
    generation += 1;
    isReady.value = false;
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (!engine) {
      return portOk(undefined);
    }
    return record(await engine.dispose());
  }

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      void dispose();
    });
  }

  return {
    host,
    isReady: readonly(isReady),
    lastError: readonly(lastError),
    diagnostics: readonly(diagnostics),
    initialize,
    render,
    previewCrop,
    getOutputCanvas,
    setOutputCaptureActive,
    readFrameDelivery,
    dispose,
  };
}

const STUDIO_COMPOSITION_ENGINE: InjectionKey<CompositionEngineHandle> = Symbol('studio-composition-engine');

/** Studio-wide engine: the boot loader initializes it, ScenePreviewFrame hosts and renders it. */
export function provideStudioCompositionEngine(audio?: {
  readProgramFrequency: (bins: Uint8Array) => boolean;
}): CompositionEngineHandle {
  const store = useStudioSessionStore();
  const { t } = useI18n();
  const captureQuality = useScreenCaptureQuality();
  const { fitLayersToPicture } = useScreenLayerFraming();

  const handle = useCompositionEngine({
    getCompositionSize: () => outputFrame(store.project),
    getRetainedSceneIds: () => store.project?.scenes.map((scene) => scene.id) ?? [],
    resolveSourceAssetId: (sourceId) => {
      const source = store.project?.sources.find((item) => item.id === sourceId);
      return source?.type === 'image' ? source.assetId : null;
    },
    resolveAssetUrl: (assetId) => {
      const asset = store.project?.assets.find((item) => item.id === assetId);
      if (!asset) {
        return null;
      }
      return sessionUrlForAsset(asset);
    },
    missingScreenCaption: (sourceId) => {
      const source = store.project?.sources.find((item) => item.id === sourceId);
      if (source?.type === 'screen' && source.width && source.height) {
        return t('studio.properties.screen.notLoaded');
      }
      return t('studio.properties.screen.choose');
    },
    resolveScreenStream: (sourceId) => peekScreenPreviewStream(sourceId) ?? null,
    resolveCameraStream: (sourceId) => peekCameraPreviewStream(sourceId) ?? null,
    resolveVideoFile: (sourceId) => {
      const source = store.project?.sources.find((item) => item.id === sourceId);
      if (!source) {
        return null;
      }
      const assetUrl = (assetId: string | undefined): string | null => {
        if (!assetId) {
          return null;
        }
        const asset = store.project?.assets.find((item) => item.id === assetId);
        if (!asset) {
          return null;
        }
        return sessionUrlForAsset(asset);
      };
      if (source.type === 'video') {
        return { url: assetUrl(source.assetId), mediaKind: 'video', loop: source.loop ?? false };
      }
      if (source.type === 'animation') {
        return {
          url: assetUrl(source.assetId),
          mediaKind: source.mediaKind === 'video' ? 'video' : 'image',
          loop: source.playbackMode === 'loop',
        };
      }
      return null;
    },
    readProgramSpectrum: (bins) => audio?.readProgramFrequency(bins) ?? false,
    resolveSceneTransition: (sceneId) => {
      const scene = store.project?.scenes.find((item) => item.id === sceneId);
      const transitionId = scene?.settings.defaultTransitionId;
      const transition = store.project?.transitions.find((item) => item.id === transitionId);
      if (!transition) {
        return null;
      }
      return {
        type: transition.type,
        durationMs: transition.durationMs,
        curve: transition.type === 'fade' ? (transition.settings.curve ?? 'linear') : undefined,
      };
    },
    getCapturePreviewFrameRate: () => captureQuality.previewFrameRateCap.value,
    onCapturePicture: (sourceId, picture, change) =>
      fitLayersToPicture(sourceId, picture, change === 'shown' ? 'contain' : 'keep-longest'),
  });

  provide(STUDIO_COMPOSITION_ENGINE, handle);
  return handle;
}

export function useStudioCompositionEngine(): CompositionEngineHandle {
  const handle = inject(STUDIO_COMPOSITION_ENGINE, null);
  if (!handle) {
    throw new Error('useStudioCompositionEngine() needs provideStudioCompositionEngine() in StudioWorkspace');
  }
  return handle;
}
