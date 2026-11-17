import { z } from 'zod';

import {
  type AudioChannel,
  type AudioEffect,
  type AudioFilter,
  type AudioMaster,
  type AudioMonitoringMode,
  channelOwningSource,
  createDefaultAudioChannel,
  FADER_DB_MAX,
  FADER_DB_MIN,
  SYNC_OFFSET_MS_MAX,
  SYNC_OFFSET_MS_MIN,
  TRIM_DB_MAX,
  TRIM_DB_MIN,
} from '../../models/audio.domain';
import type { ChannelId, SourceId } from '../../models/ids.domain';
import type { Project } from '../../models/project.domain';
import { portErr, portOk } from '../../ports/result';
import { displayNameSchema } from '../../schemas/display-name.schema';
import { assertInitialized, withClonedProject } from '../command-utils';
import type { CommandContext } from '../context';
import type { StudioResult } from '../errors';
import type { StudioSession } from '../session';

const trimDbSchema = z.number().min(TRIM_DB_MIN).max(TRIM_DB_MAX);
const faderDbSchema = z.number().min(FADER_DB_MIN).max(FADER_DB_MAX);
const panSchema = z.number().min(-1).max(1);
const monitoringSchema = z.enum(['off', 'monitor', 'monitor-and-output']);
const syncOffsetSchema = z.number().min(SYNC_OFFSET_MS_MIN).max(SYNC_OFFSET_MS_MAX);

export type AudioChannelDraft = {
  name: string;
  sourceIds?: SourceId[];
  trimDb?: number;
  faderDb?: number;
  pan?: number;
  muted?: boolean;
  solo?: boolean;
  monitoring?: AudioMonitoringMode;
  syncOffsetMs?: number;
  filters?: AudioFilter[];
  effects?: AudioEffect[];
};

export type AudioChannelChanges = {
  name?: string;
  trimDb?: number;
  faderDb?: number;
  pan?: number;
  muted?: boolean;
  solo?: boolean;
  monitoring?: AudioMonitoringMode;
  syncOffsetMs?: number;
  filters?: AudioFilter[];
  effects?: AudioEffect[];
};

const parseStrip = (
  changes: Pick<AudioChannelChanges, 'trimDb' | 'faderDb' | 'pan' | 'monitoring' | 'syncOffsetMs'>,
): StudioResult<void> => {
  if (changes.trimDb !== undefined && !trimDbSchema.safeParse(changes.trimDb).success) {
    return portErr({ kind: 'invalid-argument', message: 'trimDb is out of range' });
  }
  if (changes.faderDb !== undefined && !faderDbSchema.safeParse(changes.faderDb).success) {
    return portErr({ kind: 'invalid-argument', message: 'faderDb is out of range' });
  }
  if (changes.pan !== undefined && !panSchema.safeParse(changes.pan).success) {
    return portErr({ kind: 'invalid-argument', message: 'pan is out of range' });
  }
  if (changes.monitoring !== undefined && !monitoringSchema.safeParse(changes.monitoring).success) {
    return portErr({ kind: 'invalid-argument', message: 'monitoring is invalid' });
  }
  if (changes.syncOffsetMs !== undefined && !syncOffsetSchema.safeParse(changes.syncOffsetMs).success) {
    return portErr({ kind: 'invalid-argument', message: 'syncOffsetMs is out of range' });
  }
  return { ok: true, value: undefined };
};

const assertAudioSources = (project: Project, sourceIds: readonly SourceId[]): StudioResult<void> => {
  for (const sourceId of sourceIds) {
    const source = project.sources.find((item) => item.id === sourceId);
    if (!source) {
      return portErr({ kind: 'source-not-found', sourceId });
    }
    if (source.type !== 'audio') {
      return portErr({ kind: 'invalid-argument', message: 'Only audio sources can join a channel' });
    }
    const owner = channelOwningSource(project.audioMixer.channels, sourceId);
    if (owner) {
      return portErr({
        kind: 'invalid-argument',
        message: `Source ${sourceId} already belongs to channel ${owner.id}`,
      });
    }
  }
  return { ok: true, value: undefined };
};

export const updateAudioMaster = (
  session: StudioSession,
  changes: Partial<AudioMaster>,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }
  if (changes.volume !== undefined && (!Number.isFinite(changes.volume) || changes.volume < 0 || changes.volume > 1)) {
    return portErr({ kind: 'invalid-argument', message: 'Master volume is out of range' });
  }

  return withClonedProject(
    session,
    (project) => {
      project.audioMixer.master = { ...project.audioMixer.master, ...changes };
    },
    ctx,
  );
};

export const addAudioChannel = (
  session: StudioSession,
  draft: AudioChannelDraft,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const parsedName = displayNameSchema.safeParse(draft.name);
  if (!parsedName.success) {
    return portErr({
      kind: 'invalid-argument',
      message: parsedName.error.issues[0]?.message ?? 'Invalid channel name',
    });
  }

  const strip = parseStrip(draft);
  if (!strip.ok) {
    return strip;
  }

  const sourceIds = draft.sourceIds ?? [];
  const sources = assertAudioSources(session.project, sourceIds);
  if (!sources.ok) {
    return sources;
  }

  const channel: AudioChannel = {
    ...createDefaultAudioChannel({ id: ctx.generateId(), name: parsedName.data, sourceIds }),
    trimDb: draft.trimDb ?? 0,
    faderDb: draft.faderDb ?? 0,
    pan: draft.pan ?? 0,
    muted: draft.muted ?? false,
    solo: draft.solo ?? false,
    monitoring: draft.monitoring ?? 'off',
    syncOffsetMs: draft.syncOffsetMs ?? 0,
    filters: structuredClone(draft.filters ?? []),
    effects: structuredClone(draft.effects ?? []),
  };

  return withClonedProject(
    session,
    (project) => {
      project.audioMixer.channels.push(channel);
    },
    ctx,
  );
};

export const updateAudioChannel = (
  session: StudioSession,
  channelId: ChannelId,
  changes: AudioChannelChanges,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const channel = session.project.audioMixer.channels.find((item) => item.id === channelId);
  if (!channel) {
    return portErr({ kind: 'channel-not-found', channelId });
  }

  let name: string | undefined;
  if (changes.name !== undefined) {
    const parsedName = displayNameSchema.safeParse(changes.name);
    if (!parsedName.success) {
      return portErr({
        kind: 'invalid-argument',
        message: parsedName.error.issues[0]?.message ?? 'Invalid channel name',
      });
    }
    name = parsedName.data;
  }

  const strip = parseStrip(changes);
  if (!strip.ok) {
    return strip;
  }

  return withClonedProject(
    session,
    (project) => {
      const target = project.audioMixer.channels.find((item) => item.id === channelId)!;
      if (name !== undefined) {
        target.name = name;
      }
      if (changes.trimDb !== undefined) {
        target.trimDb = changes.trimDb;
      }
      if (changes.faderDb !== undefined) {
        target.faderDb = changes.faderDb;
      }
      if (changes.pan !== undefined) {
        target.pan = changes.pan;
      }
      if (changes.muted !== undefined) {
        target.muted = changes.muted;
      }
      if (changes.solo !== undefined) {
        target.solo = changes.solo;
      }
      if (changes.monitoring !== undefined) {
        target.monitoring = changes.monitoring;
      }
      if (changes.syncOffsetMs !== undefined) {
        target.syncOffsetMs = changes.syncOffsetMs;
      }
      if (changes.filters !== undefined) {
        target.filters = structuredClone(changes.filters);
      }
      if (changes.effects !== undefined) {
        target.effects = structuredClone(changes.effects);
      }
    },
    ctx,
  );
};

export const assignAudioSource = (
  session: StudioSession,
  channelId: ChannelId,
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

  const channel = session.project.audioMixer.channels.find((item) => item.id === channelId);
  if (!channel) {
    return portErr({ kind: 'channel-not-found', channelId });
  }
  if (channel.sourceIds.includes(sourceId)) {
    return portOk(session);
  }

  const source = session.project.sources.find((item) => item.id === sourceId);
  if (!source) {
    return portErr({ kind: 'source-not-found', sourceId });
  }
  if (source.type !== 'audio') {
    return portErr({ kind: 'invalid-argument', message: 'Only audio sources can join a channel' });
  }

  const owner = channelOwningSource(session.project.audioMixer.channels, sourceId);
  if (owner) {
    return portErr({
      kind: 'invalid-argument',
      message: `Source ${sourceId} already belongs to channel ${owner.id}`,
    });
  }

  return withClonedProject(
    session,
    (project) => {
      const target = project.audioMixer.channels.find((item) => item.id === channelId)!;
      target.sourceIds = [...target.sourceIds, sourceId];
    },
    ctx,
  );
};

export const removeAudioSource = (
  session: StudioSession,
  channelId: ChannelId,
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

  const channel = session.project.audioMixer.channels.find((item) => item.id === channelId);
  if (!channel) {
    return portErr({ kind: 'channel-not-found', channelId });
  }
  if (!channel.sourceIds.includes(sourceId)) {
    return portErr({ kind: 'source-not-found', sourceId });
  }

  return withClonedProject(
    session,
    (project) => {
      const target = project.audioMixer.channels.find((item) => item.id === channelId)!;
      target.sourceIds = target.sourceIds.filter((id) => id !== sourceId);
    },
    ctx,
  );
};

export const removeAudioChannel = (
  session: StudioSession,
  channelId: ChannelId,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  if (!session.project.audioMixer.channels.some((item) => item.id === channelId)) {
    return portErr({ kind: 'channel-not-found', channelId });
  }

  return withClonedProject(
    session,
    (project) => {
      project.audioMixer.channels = project.audioMixer.channels.filter((item) => item.id !== channelId);
      for (const scene of project.scenes) {
        scene.elements = scene.elements.filter(
          (element) => element.type !== 'audioVisual' || element.channelId !== channelId,
        );
      }
    },
    ctx,
  );
};
