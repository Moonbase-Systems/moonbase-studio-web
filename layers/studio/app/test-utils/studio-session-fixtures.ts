import { createProject, initializeSession, openProject } from '../application/commands/session-commands';
import { createTestCommandContext } from '../application/context';
import { createEmptyStudioSession, type StudioSession } from '../application/session';
import { createValidProject } from './project-fixtures';

export const createInitializedSession = (): StudioSession => {
  const initialized = initializeSession(createEmptyStudioSession());
  if (!initialized.ok) {
    throw new Error('Failed to initialize session fixture');
  }
  return initialized.value;
};

export const createTestContext = (ids: string[]) => createTestCommandContext({ ids, now: '2026-01-01T00:00:00.000Z' });

export const createSessionWithProject = (
  ids?: string[],
): { session: StudioSession; ctx: ReturnType<typeof createTestContext> } => {
  const ctx = createTestContext(
    ids ?? [
      'project-id-1',
      'scene-id-1',
      'scene-id-2',
      'layer-id-1',
      'layer-id-2',
      'source-id-1',
      'source-id-2',
      'effect-id-1',
      'effect-id-2',
    ],
  );

  const session = createInitializedSession();
  const created = createProject(session, { name: 'Fixture Project' }, ctx);
  if (!created.ok) {
    throw new Error('Failed to create project fixture');
  }

  return { session: created.value, ctx };
};

export const openValidProjectSession = (): StudioSession => {
  const session = createInitializedSession();
  const result = openProject(session, createValidProject(), createTestCommandContext());
  if (!result.ok) {
    throw new Error('Failed to open valid project');
  }
  return result.value;
};
