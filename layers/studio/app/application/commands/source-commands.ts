import type { SourceId } from '../../models/ids.domain';
import type {
  AudioSource,
  BrowserSource,
  CameraSource,
  ImageSource,
  ScreenSource,
  ShapeSource,
  Source,
  TextSource,
  VideoSource,
} from '../../models/source.domain';
import { portErr, portOk } from '../../ports/result';
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
  | Omit<AudioSource, 'id'>;

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
