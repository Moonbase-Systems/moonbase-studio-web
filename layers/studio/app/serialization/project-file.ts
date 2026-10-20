import { createEmptyHistory } from '../models/history.domain';
import type { Project, ProjectFile } from '../models/project.domain';
import { projectFileSchema } from '../schemas/project-file.schema';

export const CURRENT_PROJECT_FILE_FORMAT_VERSION = 1 as const;

export type ProjectFileParseError = {
  kind: 'validation';
  issues: { path: string; message: string }[];
};

export type ProjectFileParseResult =
  | { ok: true; project: Project; file: ProjectFile }
  | { ok: false; error: ProjectFileParseError };

/**
 * v1 has no migrations yet. Future versions bump formatVersion and transform here.
 */
export const migrateProjectFile = (raw: unknown): unknown => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }

  const candidate = raw as { formatVersion?: unknown };
  if (candidate.formatVersion === CURRENT_PROJECT_FILE_FORMAT_VERSION) {
    return raw;
  }

  return raw;
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
  const parsed = projectFileSchema.safeParse(migrated);

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
  const project: Project = {
    ...file.project,
    history: createEmptyHistory(),
  };

  return { ok: true, project, file };
};

const safeJsonParse = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};
