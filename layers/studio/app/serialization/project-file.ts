import { createEmptyHistory } from '../models/history.domain';
import type { Project, ProjectFile } from '../models/project.domain';
import { defaultAnimationFormat } from '../models/source.domain';
import { projectFileSchema } from '../schemas/project-file.schema';
import { type AudioMigrationConflict, migrateProjectFileV2ToV3 } from './audio-migration';
import { migrateProjectFileV1ToV2 } from './project-file-migrate-v1-v2';
import { migrateProjectFileV3ToV4 } from './project-file-migrate-v3-v4';

export const CURRENT_PROJECT_FILE_FORMAT_VERSION = 4 as const;

const defaultProfileId = (): string => crypto.randomUUID();

export type ProjectFileParseError = {
  kind: 'validation';
  issues: { path: string; message: string }[];
};

export type ProjectFileParseResult =
  | { ok: true; project: Project; file: ProjectFile; conflicts: AudioMigrationConflict[] }
  | { ok: false; error: ProjectFileParseError };

/**
 * v1 files are upgraded to v2, v2 files to v3 (project audio channels), then v3 to v4
 * (output profile). Conflicts are returned beside the file and are not written back by this step.
 * The profile id is generated only while leaving v3. A file that is already v4 is not passed to that step.
 */
export const migrateProjectFile = (
  raw: unknown,
  generateId: () => string = defaultProfileId,
): { file: unknown; conflicts: AudioMigrationConflict[] } => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { file: raw, conflicts: [] };
  }

  let current: unknown = raw;
  let conflicts: AudioMigrationConflict[] = [];
  const candidate = raw as { formatVersion?: unknown };
  if (candidate.formatVersion === 1) {
    current = migrateProjectFileV1ToV2(raw);
  }

  const upgraded = current as { formatVersion?: unknown };
  if (upgraded && typeof upgraded === 'object' && upgraded.formatVersion === 2) {
    const audio = migrateProjectFileV2ToV3(current);
    current = audio.file;
    conflicts = audio.conflicts;
  }

  const withAudio = current as { formatVersion?: unknown };
  if (withAudio && typeof withAudio === 'object' && withAudio.formatVersion === 3) {
    current = migrateProjectFileV3ToV4(current, generateId);
  }

  return { file: current, conflicts };
};

export const toProjectFile = (project: Project): ProjectFile => {
  const { history: _history, ...persistable } = project;
  return {
    formatVersion: CURRENT_PROJECT_FILE_FORMAT_VERSION,
    project: persistable,
  };
};

export const serializeProjectFile = (project: Project): string => {
  return JSON.stringify(toProjectFile(project));
};

const EXPORT_FILENAME_FALLBACK = 'project';

/** Download payload for the current document. Does not write the catalog or clear the dirty flag. */
export const projectExportPayload = (project: Project): { filename: string; body: string } => {
  const safe = project.name
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return {
    filename: `${safe || EXPORT_FILENAME_FALLBACK}.json`,
    body: serializeProjectFile(project),
  };
};

export const parseProjectFile = (input: unknown): ProjectFileParseResult => {
  const migrated = migrateProjectFile(typeof input === 'string' ? safeJsonParse(input) : input);
  const parsed = projectFileSchema.safeParse(migrated.file);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: 'validation',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
        })),
      },
    };
  }

  const file = parsed.data as ProjectFile;
  for (const source of file.project.sources) {
    if (source.type === 'animation' && !source.format) {
      source.format = defaultAnimationFormat(source.mediaKind);
    }
  }
  const project: Project = {
    ...file.project,
    history: createEmptyHistory(),
  };

  return { ok: true, project, file, conflicts: migrated.conflicts };
};

const safeJsonParse = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};
