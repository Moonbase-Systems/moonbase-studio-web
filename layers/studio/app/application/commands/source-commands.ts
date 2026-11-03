import { z } from 'zod';

import type { AssetId, SourceId } from '../../models/ids.domain';
import type { Project } from '../../models/project.domain';
import {
  type AnimationEndBehavior,
  type AnimationFormat,
  type AnimationMediaKind,
  type AnimationPlaybackMode,
  type AnimationPlaybackTrigger,
  type AnimationSource,
  type AudioSource,
  type BrowserSource,
  type CameraSource,
  defaultAnimationFormat,
  type ImageSource,
  type ScreenSource,
  type ShapeSource,
  type Source,
  type TextSource,
  type VideoSource,
} from '../../models/source.domain';
import { portErr, portOk } from '../../ports/result';
import { animationSourceSettingsSchema } from '../../schemas/animation-source.schema';
import { assertInitialized, withClonedProject } from '../command-utils';
import type { CommandContext } from '../context';
import type { StudioError, StudioReference, StudioResult } from '../errors';
import type { StudioSession } from '../session';

export type SourceDefinition =
  | Omit<BrowserSource, 'id'>
  | Omit<CameraSource, 'id'>
  | Omit<ScreenSource, 'id'>
  | Omit<ImageSource, 'id'>
  | Omit<VideoSource, 'id'>
  | Omit<TextSource, 'id'>
  | Omit<ShapeSource, 'id'>
  | Omit<AudioSource, 'id'>
  | Omit<AnimationSource, 'id'>;

const collectSourceReferences = (session: StudioSession, sourceId: SourceId): StudioReference[] => {
  const project = session.project!;
  const references: StudioReference[] = [];

  for (const scene of project.scenes) {
    for (const element of scene.elements) {
      if (element.type !== 'overlay' && element.sourceId === sourceId) {
        references.push({ kind: 'layer', sceneId: scene.id, layerId: element.id });
      }
    }
  }

  for (const channel of project.audioMixer.channels) {
    if (channel.sourceId === sourceId) {
      references.push({ kind: 'audio-channel', channelId: channel.id });
    }
  }

  return references;
};

const ensureAssetForSource = (project: Project, source: Source, name: string): void => {
  let assetId: AssetId | undefined;
  let assetType: 'image' | 'video' | undefined;

  if (source.type === 'image' || source.type === 'video') {
    assetId = source.assetId;
    assetType = source.type;
  }

  if (!assetId || !assetType) {
    return;
  }

  if (project.assets.some((asset) => asset.id === assetId)) {
    return;
  }

  project.assets.push({
    id: assetId,
    name,
    type: assetType,
    location: { kind: 'storageKey', key: 'pending/image' },
    availability: 'missing',
  });
};

export const addSource = (
  session: StudioSession,
  definition: SourceDefinition,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const trimmed = definition.name.trim();
  if (!trimmed) {
    return portErr({ kind: 'invalid-argument', message: 'Source name cannot be empty' });
  }

  const source = { ...structuredClone(definition), id: ctx.generateId(), name: trimmed } as Source;

  return withClonedProject(
    session,
    (project) => {
      ensureAssetForSource(project, source, trimmed);
      project.sources.push(source);
    },
    ctx,
  );
};

export const renameSource = (
  session: StudioSession,
  sourceId: SourceId,
  name: string,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return portErr({ kind: 'invalid-argument', message: 'Source name cannot be empty' });
  }

  const source = session.project.sources.find((item) => item.id === sourceId);
  if (!source) {
    return portErr({ kind: 'source-not-found', sourceId });
  }

  return withClonedProject(
    session,
    (project) => {
      const target = project.sources.find((item) => item.id === sourceId)!;
      target.name = trimmed;
    },
    ctx,
  );
};

const browserSourceSchema = z.object({
  url: z.string().url(),
  width: z.number().positive(),
  height: z.number().positive(),
  refreshSettings: z.object({
    intervalMs: z.number().positive().nullable(),
    refreshOnActivate: z.boolean(),
    bypassCache: z.boolean(),
  }),
});

export type BrowserSourceChanges = {
  url?: string;
  width?: number;
  height?: number;
  refreshSettings?: Partial<BrowserSource['refreshSettings']>;
};

export const updateBrowserSource = (
  session: StudioSession,
  sourceId: SourceId,
  changes: BrowserSourceChanges,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const source = session.project.sources.find((item) => item.id === sourceId);
  if (!source) {
    return portErr({ kind: 'source-not-found', sourceId });
  }
  if (source.type !== 'browser') {
    return portErr({ kind: 'invalid-argument', message: 'Source is not a browser source' });
  }

  const parsed = browserSourceSchema.safeParse({
    url: changes.url ?? source.url,
    width: changes.width ?? source.width,
    height: changes.height ?? source.height,
    refreshSettings: { ...source.refreshSettings, ...changes.refreshSettings },
  });
  if (!parsed.success) {
    return portErr({
      kind: 'invalid-argument',
      message: parsed.error.issues[0]?.message ?? 'Invalid browser source',
    });
  }

  return withClonedProject(
    session,
    (project) => {
      const target = project.sources.find((item) => item.id === sourceId);
      if (!target || target.type !== 'browser') {
        return;
      }
      target.url = parsed.data.url;
      target.width = parsed.data.width;
      target.height = parsed.data.height;
      target.refreshSettings = parsed.data.refreshSettings;
    },
    ctx,
  );
};

export type AnimationSourceChanges = {
  mediaKind?: AnimationMediaKind;
  format?: AnimationFormat;
  assetId?: AssetId;
  startFrame?: number;
  startOffsetMs?: number;
  startPositionMs?: number;
  durationMs?: number | null;
  trigger?: AnimationPlaybackTrigger;
  intervalMs?: number | null;
  playbackMode?: AnimationPlaybackMode;
  repeatCount?: number | null;
  playbackRate?: number;
  pauseOnHide?: boolean;
  resetOnSceneStart?: boolean;
  endBehavior?: AnimationEndBehavior;
  volume?: number;
};

export const updateAnimationSource = (
  session: StudioSession,
  sourceId: SourceId,
  changes: AnimationSourceChanges,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const source = session.project.sources.find((item) => item.id === sourceId);
  if (!source) {
    return portErr({ kind: 'source-not-found', sourceId });
  }
  if (source.type !== 'animation') {
    return portErr({ kind: 'invalid-argument', message: 'Source is not an animation source' });
  }

  const mediaKind = changes.mediaKind ?? source.mediaKind;
  const parsed = animationSourceSettingsSchema.safeParse({
    mediaKind,
    format: changes.format ?? source.format ?? defaultAnimationFormat(mediaKind),
    assetId: changes.assetId ?? source.assetId,
    startFrame: changes.startFrame ?? source.startFrame,
    startOffsetMs: changes.startOffsetMs ?? source.startOffsetMs,
    startPositionMs: changes.startPositionMs ?? source.startPositionMs ?? 0,
    durationMs: changes.durationMs !== undefined ? changes.durationMs : source.durationMs,
    trigger: changes.trigger ?? source.trigger,
    intervalMs: changes.intervalMs !== undefined ? changes.intervalMs : source.intervalMs,
    playbackMode: changes.playbackMode ?? source.playbackMode ?? 'once',
    repeatCount: changes.repeatCount !== undefined ? changes.repeatCount : (source.repeatCount ?? 1),
    playbackRate: changes.playbackRate ?? source.playbackRate ?? 1,
    pauseOnHide: changes.pauseOnHide ?? source.pauseOnHide ?? true,
    resetOnSceneStart: changes.resetOnSceneStart ?? source.resetOnSceneStart ?? false,
    endBehavior: changes.endBehavior ?? source.endBehavior ?? 'hold',
    volume: changes.volume ?? source.volume ?? 1,
  });
  if (!parsed.success) {
    return portErr({
      kind: 'invalid-argument',
      message: parsed.error.issues[0]?.message ?? 'Invalid animation source',
    });
  }

  return withClonedProject(
    session,
    (project) => {
      const target = project.sources.find((item) => item.id === sourceId);
      if (!target || target.type !== 'animation') {
        return;
      }
      target.mediaKind = parsed.data.mediaKind;
      target.format = parsed.data.format ?? defaultAnimationFormat(parsed.data.mediaKind);
      target.assetId = parsed.data.assetId;
      target.startFrame = parsed.data.startFrame;
      target.startOffsetMs = parsed.data.startOffsetMs;
      target.startPositionMs = parsed.data.startPositionMs;
      target.durationMs = parsed.data.durationMs;
      target.trigger = parsed.data.trigger;
      target.intervalMs = parsed.data.intervalMs;
      target.playbackMode = parsed.data.playbackMode;
      target.repeatCount = parsed.data.repeatCount;
      target.playbackRate = parsed.data.playbackRate;
      target.pauseOnHide = parsed.data.pauseOnHide;
      target.resetOnSceneStart = parsed.data.resetOnSceneStart;
      target.endBehavior = parsed.data.endBehavior;
      target.volume = parsed.data.volume;
    },
    ctx,
  );
};

export const findSource = (session: StudioSession, sourceId: SourceId): StudioResult<Source> => {
  if (!session.isInitialized) {
    return portErr({ kind: 'invalid-state', reason: 'Session is not initialized' });
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const source = session.project.sources.find((item) => item.id === sourceId);
  if (!source) {
    return portErr({ kind: 'source-not-found', sourceId });
  }

  return portOk(source);
};

/** Rejects removal when any layer or audio channel still references the source. */
export const removeSource = (
  session: StudioSession,
  sourceId: SourceId,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const source = session.project.sources.find((item) => item.id === sourceId);
  if (!source) {
    return portErr({ kind: 'source-not-found', sourceId });
  }

  const references = collectSourceReferences(session, sourceId);
  if (references.length > 0) {
    const error: StudioError = {
      kind: 'reference-conflict',
      sourceId,
      references,
    };
    return portErr(error);
  }

  return withClonedProject(
    session,
    (project) => {
      project.sources = project.sources.filter((item) => item.id !== sourceId);
    },
    ctx,
  );
};
