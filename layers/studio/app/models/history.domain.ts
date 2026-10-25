import type { ElementId, HistoryEntryId, SceneId } from './ids.domain';
import type { Project } from './project.domain';

/** Document + editor selection at a point in time — no history stack inside document. */
export type HistorySnapshot = {
  document: Omit<Project, 'history'>;
  activeSceneId: SceneId | null;
  selectedElementIds: ElementId[];
};

/** Serializable patch payload — no UI/runtime references. */
export type HistoryPatch = {
  forward: HistorySnapshot;
  inverse: HistorySnapshot;
};

export type HistoryEntry = {
  id: HistoryEntryId;
  label: string;
  timestamp: string;
  patch: HistoryPatch;
};

/** Session-only; stripped from ProjectFile. */
export type ProjectHistory = {
  past: HistoryEntry[];
  future: HistoryEntry[];
  limit: number;
};

export const createEmptyHistory = (limit = 100): ProjectHistory => ({
  past: [],
  future: [],
  limit,
});
