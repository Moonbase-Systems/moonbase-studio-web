import { describe, expect, it } from 'vitest';

import { shortDeviceName } from './device-label';

describe('short device name', () => {
  it('keeps the part before the vendor parenthesis', () => {
    const taken = new Set<string>();
    expect(shortDeviceName('Microphone Array (Intel® Smart Sound Technology for Digital Microphones)', taken)).toBe(
      'Microphone Array',
    );
  });

  it('uses the whole label when the head is too short to stand alone', () => {
    expect(shortDeviceName('M (USB Audio)', new Set())).toBe('M (USB Audio)');
  });

  it('adds a vendor hint when another device already took the short name', () => {
    expect(shortDeviceName('Microphone (Realtek High Definition Audio)', new Set(['Microphone']))).toBe(
      'Microphone · Realtek',
    );
    expect(shortDeviceName('Mikrofon (2- USB PnP Sound Device)', new Set(['Mikrofon']))).toBe('Mikrofon · USB');
  });

  it('numbers the name when the vendor hint is already taken', () => {
    const taken = new Set(['Microphone', 'Microphone · Realtek']);
    expect(shortDeviceName('Microphone (Realtek High Definition Audio)', taken)).toBe('Microphone 2');
  });
});
