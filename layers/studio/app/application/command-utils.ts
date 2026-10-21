import { createEmptyHistory } from '../models/history.domain';
import type { Project } from '../models/project.domain';
import { portErr, portOk } from '../ports/result';
import type { CommandContext } from './context';
import type { StudioResult } from './errors';
import { normalizeEditor, type StudioSession, validateProject } from './session';

export const assertInitialized = (session: StudioSession): StudioResult<StudioSession> => {
  if (!session.isInitialized) {
    return portErr({ kind: 'invalid-state', reason: 'Session is not initialized' });
  }
  return portOk(session);
};

export const assertProjectOpen = (
  session: StudioSession,
): StudioResult<{ session: StudioSession; project: Project }> => {
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }
  return portOk({ session, project: session.project });
};

export const commitProjectChange = (
  session: StudioSession,
  project: Project,
  ctx: CommandContext,
  options?: { markDirty?: boolean },
): StudioResult<StudioSession> => {
  const nextProject: Project = {
    ...project,
    metadata: { ...project.metadata, updatedAt: ctx.now() },
    history: session.project?.history ?? createEmptyHistory(),
  };

  const validated = validateProject(nextProject);
  if (!validated.ok) {
    return validated;
  }

  const markDirty = options?.markDirty !== false;

  return portOk({
    ...session,
    project: validated.value,
    editor: normalizeEditor(session.editor, validated.value),
    isDirty: markDirty ? true : session.isDirty,
  });
};

export const withClonedProject = (
  session: StudioSession,
  mutate: (project: Project) => void,
  ctx: CommandContext,
  options?: { markDirty?: boolean },
): StudioResult<StudioSession> => {
  const opened = assertProjectOpen(session);
  if (!opened.ok) {
    return opened;
  }

  const project = structuredClone(opened.value.project);
  mutate(project);
  return commitProjectChange(session, project, ctx, options);
};

export const sessionWithoutDirty = (session: StudioSession, editor: StudioSession['editor']): StudioSession => ({
  ...session,
  editor: normalizeEditor(editor, session.project),
});
