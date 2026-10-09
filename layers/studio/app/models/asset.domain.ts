import type { AssetId } from './ids.domain';

export type AssetType = 'image' | 'video' | 'audio' | 'gif' | 'other';

export type AssetAvailability = 'available' | 'missing' | 'pending';

export type AssetLocation = { kind: 'storageKey'; key: string } | { kind: 'remoteUrl'; url: string };

export type AssetMetadata = {
  mimeType?: string;
  byteSize?: number;
  width?: number;
  height?: number;
  durationMs?: number;
};

export type Asset = {
  id: AssetId;
  name: string;
  type: AssetType;
  location: AssetLocation;
  availability: AssetAvailability;
  metadata?: AssetMetadata;
};
