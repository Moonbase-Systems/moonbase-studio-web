import type { AnimationMediaKind } from '../models/source.domain';

export type MediaPixelSize = { width?: number; height?: number };

/** Natural pixel size of an image or video file. Missing when the file cannot be decoded. */
export const readMediaPixelSize = (url: string, mediaKind: AnimationMediaKind): Promise<MediaPixelSize> => {
  if (typeof document === 'undefined') {
    return Promise.resolve({});
  }

  if (mediaKind === 'video') {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const finish = (size: MediaPixelSize) => {
        video.removeAttribute('src');
        video.load();
        resolve(size);
      };
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        finish({
          width: video.videoWidth > 0 ? video.videoWidth : undefined,
          height: video.videoHeight > 0 ? video.videoHeight : undefined,
        });
      };
      video.onerror = () => finish({});
      video.src = url;
    });
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth > 0 ? image.naturalWidth : undefined,
        height: image.naturalHeight > 0 ? image.naturalHeight : undefined,
      });
    };
    image.onerror = () => resolve({});
    image.src = url;
  });
};
