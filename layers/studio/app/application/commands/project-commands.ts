import type { ProjectSettings, ProjectType } from '../../models/project.domain';
import { portErr } from '../../ports/result';
import { displayNameSchema } from '../../schemas/display-name.schema';
import { assertInitialized, withClonedProject } from '../command-utils';
import type { CommandContext } from '../context';
import type { StudioResult } from '../errors';
import type { StudioSession } from '../session';

export type ProjectSettingsChanges = {
  video?: Partial<ProjectSettings['video']>;
  audio?: Partial<ProjectSettings['audio']>;
  output?: Partial<ProjectSettings['output']>;
  preferences?: Partial<ProjectSettings['preferences']>;
};

export type ProjectChanges = {
  name?: string;
  type?: ProjectType;
  description?: string;
  settings?: ProjectSettingsChanges;
};

export const updateProject = (
  session: StudioSession,
  changes: ProjectChanges,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  let name: string | undefined;
  if (changes.name !== undefined) {
    const parsed = displayNameSchema.safeParse(changes.name);
    if (!parsed.success) {
      return portErr({
        kind: 'invalid-argument',
        message: parsed.error.issues[0]?.message ?? 'Invalid project name',
      });
    }
    name = parsed.data;
  }

  const description = changes.description?.trim();

  return withClonedProject(
    session,
    (project) => {
      if (name !== undefined) {
        project.name = name;
      }
      if (changes.type !== undefined) {
        project.type = changes.type;
      }
      if (description !== undefined) {
        if (description) {
          project.metadata.description = description;
        } else {
          delete project.metadata.description;
        }
      }
      if (changes.settings?.video) {
        project.settings.video = { ...project.settings.video, ...changes.settings.video };
      }
      if (changes.settings?.audio) {
        project.settings.audio = { ...project.settings.audio, ...changes.settings.audio };
      }
      if (changes.settings?.output) {
        project.settings.output = { ...project.settings.output, ...changes.settings.output };
      }
      if (changes.settings?.preferences) {
        project.settings.preferences = { ...project.settings.preferences, ...changes.settings.preferences };
      }
    },
    ctx,
  );
};
