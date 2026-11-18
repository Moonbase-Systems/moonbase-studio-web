import { z } from 'zod';

/** http(s) address, or a root-relative path on this Studio origin such as `/overlay/lab`. */
export const isBrowserPageUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048 || /\s/.test(trimmed)) {
    return false;
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) {
    return true;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

/** Address safe to assign to an iframe. Same-origin paths stay relative. */
export const resolveBrowserPageUrl = (value: string | undefined): string | null => {
  if (!value || !isBrowserPageUrl(value)) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  return new URL(trimmed).href;
};

/** A remote page, such as a StreamElements or Streamlabs overlay. Same-origin paths are our own renderer. */
export const isExternalBrowserPageUrl = (value: string | undefined): boolean => {
  const resolved = resolveBrowserPageUrl(value);
  return resolved !== null && !resolved.startsWith('/');
};

export const browserPageUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value === '' || isBrowserPageUrl(value),
    'Browser URL must be empty, an http(s) address, or a same-origin path',
  );

/** Page zoom inside the layer. 1 keeps the source resolution; higher values lay the page out smaller and stretch it to the same frame. */
export const BROWSER_ZOOM_MIN = 1;
export const BROWSER_ZOOM_MAX = 4;
export const BROWSER_ZOOM_DEFAULT = 1;

/** Viewport for a new browser layer. An alert does not need a full-frame page. */
export const BROWSER_FRAME_SIZE = 500;

export const browserZoomSchema = z.number().min(BROWSER_ZOOM_MIN).max(BROWSER_ZOOM_MAX).default(BROWSER_ZOOM_DEFAULT);

export const browserZoom = (value: number | undefined): number => {
  if (value === undefined || !Number.isFinite(value)) {
    return BROWSER_ZOOM_DEFAULT;
  }
  return Math.min(BROWSER_ZOOM_MAX, Math.max(BROWSER_ZOOM_MIN, value));
};

/**
 * Layout viewport of the loaded page. Overlay widgets are positioned on the project frame
 * (usually 1920×1080). A new layer stores 500×500 until an address is set, which would clip
 * those widgets, so an external page still at that default uses the project frame instead.
 */
export const browserPageViewport = (
  source: { url: string; width: number; height: number },
  video: { width: number; height: number },
): { width: number; height: number } => {
  const usesProjectFrame =
    isExternalBrowserPageUrl(source.url) &&
    source.width === BROWSER_FRAME_SIZE &&
    source.height === BROWSER_FRAME_SIZE &&
    video.width > 0 &&
    video.height > 0;
  if (usesProjectFrame) {
    return { width: video.width, height: video.height };
  }
  return { width: Math.max(source.width, 1), height: Math.max(source.height, 1) };
};

/** External overlays are positioned in page pixels, so zoom must not shrink that viewport. */
export const browserLayoutZoom = (source: { url: string; zoom?: number }): number | undefined =>
  isExternalBrowserPageUrl(source.url) ? 1 : source.zoom;

/** CSS viewport of the page. A higher zoom lays the page out smaller, then the frame stretches it back. */
export const browserLayoutSize = (
  width: number,
  height: number,
  zoom: number | undefined,
): { width: number; height: number; zoom: number } => {
  const scale = browserZoom(zoom);
  return {
    width: Math.max(width, 1) / scale,
    height: Math.max(height, 1) / scale,
    zoom: scale,
  };
};

type CropFractions = { left: number; right: number; top: number; bottom: number };

/**
 * Places the cropped page inside the layer box without stretching it, the same way an image
 * uses contain. `a` and `d` are one scale; `tx`/`ty` centre that region and shift the trimmed edges out.
 */
export const browserCropPlacement = (
  box: { width: number; height: number },
  layout: { width: number; height: number },
  crop: CropFractions,
): { a: number; d: number; tx: number; ty: number } => {
  const visibleWidth = Math.max(1 - crop.left - crop.right, 1e-6);
  const visibleHeight = Math.max(1 - crop.top - crop.bottom, 1e-6);
  const pageWidth = layout.width * visibleWidth;
  const pageHeight = layout.height * visibleHeight;
  const scale = Math.min(box.width / pageWidth, box.height / pageHeight);
  const tx = (box.width - pageWidth * scale) / 2 - crop.left * layout.width * scale;
  const ty = (box.height - pageHeight * scale) / 2 - crop.top * layout.height * scale;
  return {
    a: scale,
    d: scale,
    tx: tx === 0 ? 0 : tx,
    ty: ty === 0 ? 0 : ty,
  };
};
