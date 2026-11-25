import { peekAssetUrl } from '../assets/asset-session';

/** Session object URL for a local audio asset. `storageKey` is not a file path. */
export function peekOverlayAssetUrl(assetId: string) {
  return peekAssetUrl(assetId);
}
