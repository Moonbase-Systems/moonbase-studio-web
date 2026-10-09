import type { HistoryEntryId } from './ids.domain';

/** Serializable patch payload — no UI/runtime references. */
export type HistoryPatch = {
  forward: unknown;
  inverse: unknown;
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
