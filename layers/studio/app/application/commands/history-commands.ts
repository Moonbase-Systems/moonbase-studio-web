import type { HistoryEntry } from '../../models/history.domain';
import { portErr, portOk } from '../../ports/result';
import { assertInitialized, assertProjectOpen } from '../command-utils';
import type { CommandContext } from '../context';
import type { StudioResult } from '../errors';
import { applyHistorySnapshot } from '../history-apply';
import type { StudioSession } from '../session';

export const undo = (session: StudioSession, ctx: CommandContext): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  const opened = assertProjectOpen(session);
  if (!opened.ok) {
    return opened;
  }

  const { project } = opened.value;
  const entry = project.history.past.at(-1);
  if (!entry) {
    return portErr({ kind: 'invalid-state', reason: 'Nothing to undo' });
  }

  const past = project.history.past.slice(0, -1);
  const future = [...project.history.future, entry];

  return applyHistorySnapshot(session, entry.patch.inverse, { past, future }, ctx);
};

export const redo = (session: StudioSession, ctx: CommandContext): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  const opened = assertProjectOpen(session);
  if (!opened.ok) {
    return opened;
  }

  const { project } = opened.value;
  const entry = project.history.future.at(-1);
  if (!entry) {
    return portErr({ kind: 'invalid-state', reason: 'Nothing to redo' });
  }

  const future = project.history.future.slice(0, -1);
  const past = [...project.history.past, entry];

  return applyHistorySnapshot(session, entry.patch.forward, { past, future }, ctx);
};

export const pushHistoryEntry = (
  session: StudioSession,
  entry: HistoryEntry,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const opened = assertProjectOpen(session);
  if (!opened.ok) {
    return opened;
  }

  const { project } = opened.value;
  let past = [...project.history.past, entry];
  const limit = project.history.limit;
  if (past.length > limit) {
    past = past.slice(past.length - limit);
  }

  const nextProject = {
    ...project,
    history: {
      ...project.history,
      past,
      future: [],
    },
    metadata: { ...project.metadata, updatedAt: ctx.now() },
  };

  return portOk({
    ...session,
    project: nextProject,
    isDirty: true,
  });
};
