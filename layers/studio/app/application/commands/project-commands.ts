import { outputPresetById } from '../../models/output-profile.domain';
import type { ProjectSettings, ProjectType } from '../../models/project.domain';
import { portErr, portOk } from '../../ports/result';
import { displayNameSchema } from '../../schemas/display-name.schema';
import { outputFrameNumberSchema } from '../../schemas/output-profile.schema';
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

export type OutputProfileChanges = {
  name?: string;
  width?: number;
  height?: number;
  frameRate?: number;
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

const invalidProfile = (message: string): StudioResult<StudioSession> => portErr({ kind: 'invalid-argument', message });

/** Edits the active profile in place. Keeps `id` and `originPresetId`. */
export const updateOutputProfile = (
  session: StudioSession,
  changes: OutputProfileChanges,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }

  const next: OutputProfileChanges = {};
  if (changes.name !== undefined) {
    const parsed = displayNameSchema.safeParse(changes.name);
    if (!parsed.success) {
      return invalidProfile(parsed.error.issues[0]?.message ?? 'Invalid output profile name');
    }
    next.name = parsed.data;
  }
  if (changes.width !== undefined) {
    const parsed = outputFrameNumberSchema.safeParse(changes.width);
    if (!parsed.success) {
      return invalidProfile('Invalid output width');
    }
    next.width = parsed.data;
  }
  if (changes.height !== undefined) {
    const parsed = outputFrameNumberSchema.safeParse(changes.height);
    if (!parsed.success) {
      return invalidProfile('Invalid output height');
    }
    next.height = parsed.data;
  }
  if (changes.frameRate !== undefined) {
    const parsed = outputFrameNumberSchema.safeParse(changes.frameRate);
    if (!parsed.success) {
      return invalidProfile('Invalid output frame rate');
    }
    next.frameRate = parsed.data;
  }

  const current = session.project.settings.outputProfile;
  if (
    (next.name === undefined || next.name === current.name) &&
    (next.width === undefined || next.width === current.width) &&
    (next.height === undefined || next.height === current.height) &&
    (next.frameRate === undefined || next.frameRate === current.frameRate)
  ) {
    return portOk(session);
  }

  return withClonedProject(
    session,
    (project) => {
      project.settings.outputProfile = { ...project.settings.outputProfile, ...next };
    },
    ctx,
  );
};

export const updateOutputProfileName = (
  session: StudioSession,
  name: string,
  ctx: CommandContext,
): StudioResult<StudioSession> => updateOutputProfile(session, { name }, ctx);

/** Copies a built-in preset onto the active profile. The profile id stays. */
export const applyOutputPreset = (
  session: StudioSession,
  presetId: string,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }
  const preset = outputPresetById(presetId);
  if (!preset) {
    return invalidProfile(`Unknown output preset ${presetId}`);
  }

  const current = session.project.settings.outputProfile;
  if (
    current.name === preset.name &&
    current.width === preset.width &&
    current.height === preset.height &&
    current.frameRate === preset.frameRate &&
    current.originPresetId === preset.id
  ) {
    return portOk(session);
  }

  return withClonedProject(
    session,
    (project) => {
      project.settings.outputProfile = {
        ...project.settings.outputProfile,
        name: preset.name,
        width: preset.width,
        height: preset.height,
        frameRate: preset.frameRate,
        originPresetId: preset.id,
      };
    },
    ctx,
  );
};
