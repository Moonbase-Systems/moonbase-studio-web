import type { ProjectId } from '../models/ids.domain';
import type { Project, ProjectFile, ProjectMeta } from '../models/project.domain';
import { portErr, portOk, type PortResult } from '../ports/result';
import type { SceneRepository, SceneRepositoryError } from '../ports/scene-repository';
import { parseProjectFile, toProjectFile } from '../serialization/project-file';

export type ProjectFileBackend = {
  get(id: ProjectId): Promise<unknown | undefined>;
  put(file: ProjectFile): Promise<void>;
  list(): Promise<unknown[]>;
  remove(id: ProjectId): Promise<void>;
};

const toRepositoryError = (error: unknown): SceneRepositoryError => ({
  kind: 'io',
  message: error instanceof Error ? error.message : 'Project storage failed',
});

const readProject = (raw: unknown): PortResult<Project, SceneRepositoryError> => {
  const parsed = parseProjectFile(raw);
  if (!parsed.ok) {
    return portErr({ kind: 'validation', issues: parsed.error.issues });
  }
  return portOk(parsed.project);
};

export const createSceneRepository = (backend: ProjectFileBackend): SceneRepository => ({
  async loadProject(id) {
    try {
      const raw = await backend.get(id);
      if (raw === undefined) {
        return portErr({ kind: 'not-found', projectId: id });
      }
      return readProject(raw);
    } catch (error) {
      return portErr(toRepositoryError(error));
    }
  },

  async saveProject(project) {
    try {
      const parsed = parseProjectFile(toProjectFile(project));
      if (!parsed.ok) {
        return portErr({ kind: 'validation', issues: parsed.error.issues });
      }
      await backend.put(parsed.file);
      return portOk(undefined);
    } catch (error) {
      return portErr(toRepositoryError(error));
    }
  },

  async listProjects(): Promise<PortResult<ProjectMeta[], SceneRepositoryError>> {
    try {
      const records = await backend.list();
      const metas: ProjectMeta[] = [];
      for (const raw of records) {
        const parsed = parseProjectFile(raw);
        if (!parsed.ok) {
          continue;
        }
        metas.push({
          id: parsed.project.id,
          name: parsed.project.name,
          type: parsed.project.type,
          updatedAt: parsed.project.metadata.updatedAt,
        });
      }
      metas.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      return portOk(metas);
    } catch (error) {
      return portErr(toRepositoryError(error));
    }
  },

  async deleteProject(id) {
    try {
      const raw = await backend.get(id);
      if (raw === undefined) {
        return portErr({ kind: 'not-found', projectId: id });
      }
      await backend.remove(id);
      return portOk(undefined);
    } catch (error) {
      return portErr(toRepositoryError(error));
    }
  },
});
