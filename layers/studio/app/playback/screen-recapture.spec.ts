import { describe, expect, it } from 'vitest';

import { reuseScreenSourceOnPick, screenPreviewMessageKey } from './screen-recapture';

describe('screen recapture', () => {
  it('keeps a saved screen source and asks for a new capture when the stream is gone', () => {
    expect(reuseScreenSourceOnPick({ width: 1920, height: 1080 })).toBe(true);
    expect(reuseScreenSourceOnPick({})).toBe(false);
    expect(reuseScreenSourceOnPick(null)).toBe(false);
    expect(screenPreviewMessageKey(false, true)).toBe('studio.properties.screen.notLoaded');
    expect(screenPreviewMessageKey(false, false)).toBe('studio.properties.screen.choose');
    expect(screenPreviewMessageKey(true, true)).toBe('studio.properties.screen.choose');
  });
});
