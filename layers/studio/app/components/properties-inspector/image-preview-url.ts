import { peekAssetUrl } from '../../infrastructure/assets/asset-session';

export function peekImagePreviewUrl(assetId: string) {
  return peekAssetUrl(assetId);
}
