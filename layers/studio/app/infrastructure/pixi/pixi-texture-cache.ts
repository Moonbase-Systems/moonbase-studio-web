import { ImageSource, Texture } from 'pixi.js';

export type TextureScaleMode = 'linear' | 'nearest';

type TextureEntry = {
  refs: number;
  promise: Promise<Texture>;
  texture: Texture | null;
  bitmap: ImageBitmap | null;
  controller: AbortController;
};

/**
 * One texture per (url, scale mode), shared by every element that shows it.
 * The texture is destroyed only when the last holder releases it.
 * Loads bypass the global `Assets` cache so another engine instance cannot unload them.
 */
export type PixiTextureCache = {
  acquire(url: string, scaleMode: TextureScaleMode): Promise<Texture>;
  release(url: string, scaleMode: TextureScaleMode): void;
  destroy(): void;
};

const loadBitmap = async (url: string, signal: AbortSignal): Promise<ImageBitmap> => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Image request failed with HTTP ${response.status}`);
  }
  return createImageBitmap(await response.blob());
};

const freeEntry = (entry: TextureEntry): void => {
  if (entry.texture) {
    entry.texture.destroy(true);
    entry.texture = null;
  } else {
    entry.controller.abort();
  }
  entry.bitmap?.close();
  entry.bitmap = null;
};

export const createPixiTextureCache = (): PixiTextureCache => {
  const entries = new Map<string, TextureEntry>();
  let destroyed = false;

  const keyOf = (url: string, scaleMode: TextureScaleMode): string => `${scaleMode} ${url}`;

  return {
    acquire(url, scaleMode) {
      if (destroyed) {
        return Promise.reject(new Error('Texture cache is destroyed'));
      }

      const key = keyOf(url, scaleMode);
      const existing = entries.get(key);
      if (existing) {
        existing.refs += 1;
        return existing.promise;
      }

      const controller = new AbortController();
      const entry: TextureEntry = {
        refs: 1,
        promise: loadBitmap(url, controller.signal).then((bitmap) => {
          if (entries.get(key) !== entry) {
            bitmap.close();
            throw new Error('Texture was released before it finished loading');
          }
          entry.bitmap = bitmap;
          entry.texture = new Texture({ source: new ImageSource({ resource: bitmap, scaleMode }) });
          return entry.texture;
        }),
        texture: null,
        bitmap: null,
        controller,
      };
      entries.set(key, entry);
      return entry.promise;
    },

    release(url, scaleMode) {
      const key = keyOf(url, scaleMode);
      const entry = entries.get(key);
      if (!entry) {
        return;
      }
      entry.refs -= 1;
      if (entry.refs > 0) {
        return;
      }
      entries.delete(key);
      freeEntry(entry);
    },

    destroy() {
      destroyed = true;
      for (const entry of entries.values()) {
        freeEntry(entry);
      }
      entries.clear();
    },
  };
};
