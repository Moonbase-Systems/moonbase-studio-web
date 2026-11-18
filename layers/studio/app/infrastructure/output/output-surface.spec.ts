import { describe, expect, it } from 'vitest';

import { sizeOutputCanvas } from './output-surface';

describe('sizeOutputCanvas', () => {
  it('uses the output profile when the editor host is a different size', () => {
    const host = { width: 640, height: 360 };
    const canvas = { width: host.width, height: host.height };
    sizeOutputCanvas(canvas, { width: 1920, height: 1080 });
    expect(canvas).toEqual({ width: 1920, height: 1080 });
    expect(host).toEqual({ width: 640, height: 360 });
  });
});
