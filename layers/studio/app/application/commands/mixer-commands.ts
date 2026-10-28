import type { AudioChannel, AudioEffect, AudioFilter, AudioMaster } from '../../models/audio.domain';
import type { ChannelId, SourceId } from '../../models/ids.domain';
import type { Project } from '../../models/project.domain';
import { portErr } from '../../ports/result';
import { displayNameSchema } from '../../schemas/display-name.schema';
import { assertInitialized, withClonedProject } from '../command-utils';
import type { CommandContext } from '../context';
import type { StudioResult } from '../errors';
import type { StudioSession } from '../session';

export type AudioChannelDraft = {
  name: string;
  sourceId?: SourceId | null;
  volume?: number;
  muted?: boolean;
  solo?: boolean;
  pan?: number;
  filters?: AudioFilter[];
  effects?: AudioEffect[];
};

export type AudioChannelChanges = {
  name?: string;
  sourceId?: SourceId | null;
  volume?: number;
  muted?: boolean;
  solo?: boolean;
  pan?: number;
  filters?: AudioFilter[];
  effects?: AudioEffect[];
};

const assertSourceExists = (project: Project, sourceId: SourceId | null | undefined): StudioResult<void> => {
  if (!sourceId) {
    return { ok: true, value: undefined };
  }
  if (!project.sources.some((source) => source.id === sourceId)) {
    return portErr({ kind: 'source-not-found', sourceId });
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

  const source = assertSourceExists(session.project, draft.sourceId);
  if (!source.ok) {
    return source;
  }

  const channel: AudioChannel = {
    id: ctx.generateId(),
    name: parsedName.data,
    sourceId: draft.sourceId ?? null,
    volume: draft.volume ?? 1,
    muted: draft.muted ?? false,
    solo: draft.solo ?? false,
    pan: draft.pan ?? 0,
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

  const source = assertSourceExists(session.project, changes.sourceId);
  if (!source.ok) {
    return source;
  }

  return withClonedProject(
    session,
    (project) => {
      const target = project.audioMixer.channels.find((item) => item.id === channelId)!;
      if (name !== undefined) {
        target.name = name;
      }
      if (changes.sourceId !== undefined) {
        target.sourceId = changes.sourceId;
      }
      if (changes.volume !== undefined) {
        target.volume = changes.volume;
      }
      if (changes.muted !== undefined) {
        target.muted = changes.muted;
      }
      if (changes.solo !== undefined) {
        target.solo = changes.solo;
      }
      if (changes.pan !== undefined) {
        target.pan = changes.pan;
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
    },
    ctx,
  );
};
