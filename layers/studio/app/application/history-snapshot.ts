import type { HistorySnapshot } from '../models/history.domain';
import type { Project } from '../models/project.domain';
import type { StudioSession } from './session';

export const captureHistorySnapshot = (session: StudioSession): HistorySnapshot | null => {
  if (!session.project) {
    return null;
  }
  const { history: _history, ...persistableProject } = session.project;
  return {
    document: structuredClone(persistableProject),
    activeSceneId: session.editor.activeSceneId,
    selectedElementIds: [...session.editor.selectedElementIds],
  };
};

const documentForCompare = (project: Omit<Project, 'history'>) => {
  const clone = structuredClone(project);
  clone.metadata = { ...clone.metadata, updatedAt: '' };
  return clone;
};

export const historySnapshotsEqual = (a: HistorySnapshot, b: HistorySnapshot): boolean => {
  if (a.activeSceneId !== b.activeSceneId) {
    return false;
  }
  if (a.selectedElementIds.length !== b.selectedElementIds.length) {
    return false;
  }
  for (let i = 0; i < a.selectedElementIds.length; i += 1) {
    if (a.selectedElementIds[i] !== b.selectedElementIds[i]) {
      return false;
    }
  }
  return JSON.stringify(documentForCompare(a.document)) === JSON.stringify(documentForCompare(b.document));
};
