const urls = new Map<string, string>();

export function holdImagePreviewUrl(assetId: string, url: string) {
  const previous = urls.get(assetId);
  if (previous && previous !== url) {
    URL.revokeObjectURL(previous);
  }
  urls.set(assetId, url);
}

export function peekImagePreviewUrl(assetId: string) {
  return urls.get(assetId);
}
