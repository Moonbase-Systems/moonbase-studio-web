import type { ProjectId } from '../models/ids.domain';
import type { Project, ProjectMeta } from '../models/project.domain';
import type { PortResult } from './result';

export type SceneRepositoryError =
  | { kind: 'not-found'; projectId: ProjectId }
  | { kind: 'validation'; issues: { path: string; message: string }[] }
  | { kind: 'io'; message: string };

/**
 * Persistent load/save of studio projects.
 * Implementations may use local storage, filesystem, or a remote API.
 */
export type SceneRepository = {
  loadProject(id: ProjectId): Promise<PortResult<Project, SceneRepositoryError>>;
  saveProject(project: Project): Promise<PortResult<void, SceneRepositoryError>>;
  listProjects?(): Promise<PortResult<ProjectMeta[], SceneRepositoryError>>;
  deleteProject?(id: ProjectId): Promise<PortResult<void, SceneRepositoryError>>;
};
