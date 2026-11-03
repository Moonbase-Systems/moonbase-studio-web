const urls = new Map<string, string>();

export function holdAnimationPreviewUrl(assetId: string, url: string) {
  const previous = urls.get(assetId);
  if (previous && previous !== url) {
    URL.revokeObjectURL(previous);
  }
  urls.set(assetId, url);
}

export function peekAnimationPreviewUrl(assetId: string) {
  return urls.get(assetId);
}
