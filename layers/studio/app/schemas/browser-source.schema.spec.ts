import { describe, expect, it } from 'vitest';

import {
  browserCropPlacement,
  browserLayoutSize,
  browserLayoutZoom,
  browserPageUrlSchema,
  browserPageViewport,
  browserZoomSchema,
  resolveBrowserPageUrl,
} from './browser-source.schema';

describe('browser page url', () => {
  it('accepts the overlay page and absolute http addresses', () => {
    expect(browserPageUrlSchema.safeParse('/overlay/lab').success).toBe(true);
    expect(browserPageUrlSchema.safeParse('https://example.com/page').success).toBe(true);
    expect(browserPageUrlSchema.safeParse('').success).toBe(true);
    expect(resolveBrowserPageUrl('/overlay/lab')).toBe('/overlay/lab');
    expect(resolveBrowserPageUrl('https://example.com/page')).toBe('https://example.com/page');
  });

  it('zooms the page by laying it out smaller inside the same frame', () => {
    expect(browserZoomSchema.parse(undefined)).toBe(1);
    expect(browserLayoutSize(1920, 1080, undefined)).toEqual({ width: 1920, height: 1080, zoom: 1 });
    expect(browserLayoutSize(1920, 1080, 2)).toEqual({ width: 960, height: 540, zoom: 2 });
    expect(browserLayoutSize(1920, 1080, 9).zoom).toBe(4);
  });

  it('shifts a cropped page so the visible part fills the layer', () => {
    expect(
      browserCropPlacement(
        { width: 200, height: 100 },
        { width: 200, height: 100 },
        { left: 0, right: 0, top: 0, bottom: 0 },
      ),
    ).toEqual({
      a: 1,
      d: 1,
      tx: 0,
      ty: 0,
    });
    expect(
      browserCropPlacement(
        { width: 150, height: 100 },
        { width: 200, height: 100 },
        { left: 0.25, right: 0, top: 0, bottom: 0 },
      ),
    ).toEqual({
      a: 1,
      d: 1,
      tx: -50,
      ty: 0,
    });
    expect(
      browserCropPlacement(
        { width: 200, height: 100 },
        { width: 100, height: 100 },
        { left: 0, right: 0, top: 0, bottom: 0 },
      ),
    ).toEqual({
      a: 1,
      d: 1,
      tx: 50,
      ty: 0,
    });
  });

  it('uses the project frame for an external overlay that is still the small default', () => {
    const video = { width: 1920, height: 1080 };
    expect(
      browserPageViewport({ url: 'https://streamelements.com/overlay/a/b', width: 500, height: 500 }, video),
    ).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(browserPageViewport({ url: '/overlay/lab', width: 500, height: 500 }, video)).toEqual({
      width: 500,
      height: 500,
    });
    expect(
      browserPageViewport({ url: 'https://streamlabs.com/alert-box/v3/demo', width: 800, height: 600 }, video),
    ).toEqual({
      width: 800,
      height: 600,
    });
    expect(browserLayoutZoom({ url: 'https://streamelements.com/overlay/a/b', zoom: 2 })).toBe(1);
    expect(browserLayoutZoom({ url: '/overlay/lab', zoom: 2 })).toBe(2);
  });

  it('rejects addresses that are not a page', () => {
    expect(browserPageUrlSchema.safeParse('not-a-url').success).toBe(false);
    expect(browserPageUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(browserPageUrlSchema.safeParse('//evil.example').success).toBe(false);
    expect(resolveBrowserPageUrl('not-a-url')).toBeNull();
  });
});
