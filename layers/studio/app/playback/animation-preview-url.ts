import { peekAssetUrl } from '../infrastructure/assets/asset-session';

export function peekAnimationPreviewUrl(assetId: string) {
  return peekAssetUrl(assetId);
}
