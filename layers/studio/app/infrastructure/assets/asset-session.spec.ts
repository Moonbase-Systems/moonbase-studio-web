import { describe, expect, it } from 'vitest';

import { peekImagePreviewUrl } from '../../components/properties-inspector/image-preview-url';
import { peekAnimationPreviewUrl } from '../../playback/animation-preview-url';
import { peekOverlayAssetUrl } from '../audio/overlay-asset-url';
import { clearAssetSession, holdAssetBlob, peekAssetBlob, peekAssetUrl, sessionUrlForAsset } from './asset-session';

describe('asset session', () => {
  it('gives the canvas, the image inspector and the animation inspector the same url', () => {
    clearAssetSession();
    const url = holdAssetBlob('asset-1', new Blob(['gif'], { type: 'image/gif' }), 'image/gif');

    expect(peekAssetUrl('asset-1')).toBe(url);
    expect(peekImagePreviewUrl('asset-1')).toBe(url);
    expect(peekAnimationPreviewUrl('asset-1')).toBe(url);
    expect(peekOverlayAssetUrl('asset-1')).toBe(url);
    expect(peekAssetBlob('asset-1')?.type).toBe('image/gif');
    expect(sessionUrlForAsset({ id: 'asset-1', location: { kind: 'storageKey', key: 'local/a' } })).toBe(url);
    expect(
      sessionUrlForAsset({ id: 'remote', location: { kind: 'remoteUrl', url: 'https://example.com/a.png' } }),
    ).toBe('https://example.com/a.png');

    clearAssetSession();
    expect(peekAssetUrl('asset-1')).toBeUndefined();
  });
});
