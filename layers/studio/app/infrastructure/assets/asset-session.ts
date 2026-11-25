import type { Asset } from '../../models/asset.domain';

type HeldAsset = {
  blob: Blob;
  url: string;
  mimeType: string;
};

const held = new Map<string, HeldAsset>();

const objectUrl = (blob: Blob): string => {
  const factory = URL as { createObjectURL?: (value: Blob) => string };
  if (typeof factory.createObjectURL === 'function') {
    return factory.createObjectURL(blob);
  }
  return `blob:moonbase/${crypto.randomUUID()}`;
};

const revokeUrl = (url: string): void => {
  if (url.startsWith('blob:moonbase/')) {
    return;
  }
  const factory = URL as { revokeObjectURL?: (value: string) => void };
  factory.revokeObjectURL?.(url);
};

/** Keeps the file bytes and a session object URL for one asset. Replaces any previous URL. */
export function holdAssetBlob(assetId: string, blob: Blob, mimeType?: string): string {
  const type = mimeType || blob.type || 'application/octet-stream';
  const file = blob.type === type ? blob : new Blob([blob], { type });
  const url = objectUrl(file);
  const previous = held.get(assetId);
  if (previous) {
    revokeUrl(previous.url);
  }
  held.set(assetId, { blob: file, url, mimeType: type });
  return url;
}

export function peekAssetUrl(assetId: string): string | undefined {
  return held.get(assetId)?.url;
}

export function peekAssetBlob(assetId: string): Blob | undefined {
  return held.get(assetId)?.blob;
}

export function peekAssetMimeType(assetId: string): string | undefined {
  return held.get(assetId)?.mimeType;
}

/** Remote assets keep their URL. Local assets resolve only while this session holds the bytes. */
export function sessionUrlForAsset(asset: Pick<Asset, 'id' | 'location'>): string | null {
  if (asset.location.kind === 'remoteUrl') {
    return asset.location.url;
  }
  return peekAssetUrl(asset.id) ?? null;
}

export function clearAssetSession(): void {
  for (const item of held.values()) {
    revokeUrl(item.url);
  }
  held.clear();
}
