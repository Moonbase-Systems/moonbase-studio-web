import type { AnimationFormat, AnimationMediaKind } from '../models/source.domain';

export type AnimationFileDetection =
  | { ok: true; mediaKind: AnimationMediaKind; format: AnimationFormat }
  | { ok: false; reason: 'unsupported' | 'static' | 'unreadable' };

const readBytes = async (file: File) => {
  const length = Math.min(file.size, 256 * 1024);
  return new Uint8Array(await file.slice(0, length).arrayBuffer());
};

const startsWith = (bytes: Uint8Array, text: string, offset = 0) => {
  if (bytes.length < offset + text.length) {
    return false;
  }
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) {
      return false;
    }
  }
  return true;
};

const hasAscii = (bytes: Uint8Array, text: string) => {
  const needle = [...text].map((char) => char.charCodeAt(0));
  for (let offset = 0; offset <= bytes.length - needle.length; offset += 1) {
    let found = true;
    for (let index = 0; index < needle.length; index += 1) {
      if (bytes[offset + index] !== needle[index]) {
        found = false;
        break;
      }
    }
    if (found) {
      return true;
    }
  }
  return false;
};

const isAnimatedWebp = (bytes: Uint8Array) => {
  if (!startsWith(bytes, 'RIFF') || !startsWith(bytes, 'WEBP', 8)) {
    return false;
  }
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const tag = String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!);
    const size =
      bytes[offset + 4]! | (bytes[offset + 5]! << 8) | (bytes[offset + 6]! << 16) | (bytes[offset + 7]! << 24);
    if (tag === 'ANIM') {
      return true;
    }
    if (tag === 'VP8X' && offset + 8 < bytes.length) {
      return (bytes[offset + 8]! & 0x02) !== 0;
    }
    offset += 8 + size + (size % 2);
  }
  return false;
};

const isAnimatedPng = (bytes: Uint8Array) => {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < signature.length || signature.some((value, index) => bytes[index] !== value)) {
    return false;
  }
  return hasAscii(bytes, 'acTL');
};

const isWebm = (bytes: Uint8Array) =>
  bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;

const isMp4 = (bytes: Uint8Array) => hasAscii(bytes.subarray(0, 64), 'ftyp');

const extensionOf = (name: string) => {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match?.[1]?.toLowerCase() ?? '';
};

export async function detectAnimationFile(file: File): Promise<AnimationFileDetection> {
  let bytes: Uint8Array;
  try {
    bytes = await readBytes(file);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (bytes.length === 0) {
    return { ok: false, reason: 'unreadable' };
  }

  const extension = extensionOf(file.name);
  const mime = file.type;

  if (startsWith(bytes, 'GIF8') || mime === 'image/gif' || extension === 'gif') {
    if (!startsWith(bytes, 'GIF8') && mime !== 'image/gif') {
      return { ok: false, reason: 'unsupported' };
    }
    return { ok: true, mediaKind: 'gif', format: 'gif' };
  }

  if (startsWith(bytes, 'RIFF') && startsWith(bytes, 'WEBP', 8)) {
    if (!isAnimatedWebp(bytes)) {
      return { ok: false, reason: 'static' };
    }
    return { ok: true, mediaKind: 'gif', format: 'webp' };
  }

  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
    if (!isAnimatedPng(bytes)) {
      return { ok: false, reason: 'static' };
    }
    return { ok: true, mediaKind: 'gif', format: 'apng' };
  }

  if (isWebm(bytes) || mime === 'video/webm' || extension === 'webm') {
    if (!isWebm(bytes) && mime !== 'video/webm') {
      return { ok: false, reason: 'unsupported' };
    }
    return { ok: true, mediaKind: 'video', format: 'webm' };
  }

  if (isMp4(bytes) || mime === 'video/mp4' || extension === 'mp4') {
    if (!isMp4(bytes) && mime !== 'video/mp4') {
      return { ok: false, reason: 'unsupported' };
    }
    return { ok: true, mediaKind: 'video', format: 'mp4' };
  }

  return { ok: false, reason: 'unsupported' };
}
