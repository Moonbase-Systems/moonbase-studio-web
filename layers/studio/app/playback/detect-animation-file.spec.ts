import { describe, expect, it } from 'vitest';

import { detectAnimationFile } from './detect-animation-file';

const fileFrom = (bytes: number[], name: string, type = '') => new File([new Uint8Array(bytes)], name, { type });

describe('detectAnimationFile', () => {
  it('recognizes a gif and an animated png', async () => {
    const gif = await detectAnimationFile(fileFrom([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 'logo.gif', 'image/gif'));
    expect(gif).toEqual({ ok: true, mediaKind: 'gif', format: 'gif' });

    const apng = await detectAnimationFile(
      fileFrom([137, 80, 78, 71, 13, 10, 26, 10, ...[...'acTL'].map((char) => char.charCodeAt(0))], 'burst.apng'),
    );
    expect(apng).toEqual({ ok: true, mediaKind: 'gif', format: 'apng' });
  });

  it('rejects a static png and accepts animated webp, webm, and mp4', async () => {
    const png = await detectAnimationFile(
      fileFrom([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0], 'still.png', 'image/png'),
    );
    expect(png).toEqual({ ok: false, reason: 'static' });

    const webp = await detectAnimationFile(
      fileFrom(
        [
          0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 0x0a, 0x00,
          0x00, 0x00, 0x02,
        ],
        'loop.webp',
        'image/webp',
      ),
    );
    expect(webp).toEqual({ ok: true, mediaKind: 'gif', format: 'webp' });

    const webm = await detectAnimationFile(fileFrom([0x1a, 0x45, 0xdf, 0xa3], 'clip.webm', 'video/webm'));
    expect(webm).toEqual({ ok: true, mediaKind: 'video', format: 'webm' });

    const mp4 = await detectAnimationFile(
      fileFrom([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], 'clip.mp4', 'video/mp4'),
    );
    expect(mp4).toEqual({ ok: true, mediaKind: 'video', format: 'mp4' });
  });

  it('rejects an unsupported file', async () => {
    const text = await detectAnimationFile(fileFrom([0x4d, 0x4f, 0x56], 'clip.mov', 'video/quicktime'));
    expect(text).toEqual({ ok: false, reason: 'unsupported' });
  });
});
