const urls = new Map<string, string>();

/** Session object URL for a local audio asset. `storageKey` is not a file path. */
export function holdOverlayAssetUrl(assetId: string, url: string) {
  const previous = urls.get(assetId);
  if (previous && previous !== url) {
    URL.revokeObjectURL(previous);
  }
  urls.set(assetId, url);
}

export function peekOverlayAssetUrl(assetId: string) {
  return urls.get(assetId);
}
