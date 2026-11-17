import { createEmptyHistory } from '../models/history.domain';
import type { Project, ProjectFile } from '../models/project.domain';
import { defaultAnimationFormat } from '../models/source.domain';
import { projectFileSchema } from '../schemas/project-file.schema';
import { type AudioMigrationConflict, migrateProjectFileV2ToV3 } from './audio-migration';
import { migrateProjectFileV1ToV2 } from './project-file-migrate-v1-v2';

export const CURRENT_PROJECT_FILE_FORMAT_VERSION = 3 as const;

export type ProjectFileParseError = {
  kind: 'validation';
  issues: { path: string; message: string }[];
};

export type ProjectFileParseResult =
  | { ok: true; project: Project; file: ProjectFile; conflicts: AudioMigrationConflict[] }
  | { ok: false; error: ProjectFileParseError };

/**
 * v1 files are upgraded to v2, then v2 files to v3 (project audio channels).
 * Conflicts are returned beside the file and are not written back by this step.
 */
export const migrateProjectFile = (raw: unknown): { file: unknown; conflicts: AudioMigrationConflict[] } => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { file: raw, conflicts: [] };
  }

  let current: unknown = raw;
  const candidate = raw as { formatVersion?: unknown };
  if (candidate.formatVersion === 1) {
    current = migrateProjectFileV1ToV2(raw);
  }

  const upgraded = current as { formatVersion?: unknown };
  if (upgraded && typeof upgraded === 'object' && upgraded.formatVersion === 2) {
    return migrateProjectFileV2ToV3(current);
  }

  return { file: current, conflicts: [] };
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
