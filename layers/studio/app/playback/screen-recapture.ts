/** A saved screen already has a size. Picking again replaces that source instead of adding another. */
export function reuseScreenSourceOnPick(source: { width?: number; height?: number } | null): boolean {
  return Boolean(source?.width && source.height);
}

export function screenPreviewMessageKey(
  hasStream: boolean,
  savedSource: boolean,
): 'studio.properties.screen.choose' | 'studio.properties.screen.notLoaded' {
  if (hasStream || !savedSource) {
    return 'studio.properties.screen.choose';
  }
  return 'studio.properties.screen.notLoaded';
}
