import type { HistorySnapshot, ProjectHistory } from '../models/history.domain';
import { portOk } from '../ports/result';
import type { CommandContext } from './context';
import type { StudioResult } from './errors';
import { normalizeEditor, type StudioSession, validateProject } from './session';

export const applyHistorySnapshot = (
  session: StudioSession,
  snapshot: HistorySnapshot,
  history: Pick<ProjectHistory, 'past' | 'future'>,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const nextProject = validateProject({
    ...structuredClone(snapshot.document),
    history: {
      ...session.project!.history,
      past: history.past,
      future: history.future,
    },
    metadata: {
      ...snapshot.document.metadata,
      updatedAt: ctx.now(),
    },
  });

  if (!nextProject.ok) {
    return nextProject;
  }

  const editor = normalizeEditor(
    {
      ...session.editor,
      activeSceneId: snapshot.activeSceneId,
      selectedElementIds: snapshot.selectedElementIds,
    },
    nextProject.value,
  );

  return portOk({
    ...session,
    project: nextProject.value,
    editor,
    isDirty: true,
  });
};
