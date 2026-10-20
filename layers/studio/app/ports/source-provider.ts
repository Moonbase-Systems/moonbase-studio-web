import type { SourceId } from '../models/ids.domain';
import type { Source } from '../models/source.domain';
import type { PortResult } from './result';

export type SourceAvailability = 'available' | 'unavailable' | 'unknown';

export type SourceProviderError =
  | { kind: 'not-found'; sourceId: SourceId }
  | { kind: 'unavailable'; sourceId: SourceId; reason?: string }
  | { kind: 'io'; message: string };

/**
 * Access to media source definitions (local devices, files, or future media Core).
 * Does not own browser media streams or DOM elements — those belong to runtime adapters.
 */
export type SourceProvider = {
  listSources(): Promise<PortResult<Source[], SourceProviderError>>;
  getSource(id: SourceId): Promise<PortResult<Source, SourceProviderError>>;
  checkAvailability?(id: SourceId): Promise<PortResult<SourceAvailability, SourceProviderError>>;
};
