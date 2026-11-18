import { describe, expect, it } from 'vitest';

import { alertText, createOverlayAlert, cueForAlert, safeAvatarUrl } from './overlay-alerts';

const follow = {
  username: 'moonbase',
  displayName: 'MoonBase',
  avatarUrl: '',
};

describe('overlay alerts', () => {
  it('builds a follow event with a new id and keeps the text as text', () => {
    const first = createOverlayAlert({
      type: 'follow',
      overlayId: 'lab',
      payload: { ...follow, username: '<img onerror=alert(1)>' },
      now: 10,
    });
    const second = createOverlayAlert({ type: 'follow', overlayId: 'lab', payload: follow, now: 11 });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }
    expect(first.alert.id).not.toBe(second.alert.id);
    expect(first.alert.timestamp).toBe(10);
    expect(first.alert.type).toBe('follow');
    if (first.alert.type !== 'follow') {
      return;
    }
    expect(first.alert.payload.username).not.toContain('<');
    expect(alertText(first.alert).name).toBe('MoonBase');
  });

  it('rejects an unsafe avatar and a donation that is not a number', () => {
    const avatar = createOverlayAlert({
      type: 'follow',
      overlayId: 'lab',
      payload: { ...follow, avatarUrl: 'javascript:alert(1)' },
    });
    const amount = createOverlayAlert({
      type: 'donation',
      overlayId: 'lab',
      payload: { username: 'moonbase', amount: '20', currency: 'PLN', message: '' },
    });
    expect(avatar.ok).toBe(false);
    expect(amount.ok).toBe(false);
    expect(safeAvatarUrl('javascript:alert(1)')).toBeNull();
    expect(safeAvatarUrl('https://cdn.example/a.png')).toBe('https://cdn.example/a.png');
  });

  it('maps the alert onto a cue without calling playback', () => {
    const created = createOverlayAlert({
      type: 'raid',
      overlayId: 'lab',
      payload: { username: 'moonbase', viewerCount: 4 },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(cueForAlert(created.alert, 'scene-1')).toEqual({ event: 'raid', sceneId: 'scene-1' });
    expect(cueForAlert(created.alert, null)).toEqual({ event: 'raid' });
  });

  it('sends the same payload again as a distinct event', () => {
    const created = createOverlayAlert({
      type: 'chat',
      overlayId: 'lab',
      payload: { username: 'moonbase', message: 'Cześć' },
      now: 5,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const again = createOverlayAlert({
      type: created.alert.type,
      overlayId: 'lab',
      payload: created.alert.payload,
      now: 6,
    });
    expect(again.ok).toBe(true);
    if (!again.ok) {
      return;
    }
    expect(again.alert.id).not.toBe(created.alert.id);
    expect(again.alert.payload).toEqual(created.alert.payload);
    expect(again.alert.sound).toBeUndefined();
  });

  it('keeps an https sound on the alert and drops a blank one', () => {
    const withSound = createOverlayAlert({
      type: 'subscription',
      overlayId: 'lab',
      payload: { username: 'moonbase', plan: 'Tier 1', months: 1, message: '' },
      sound: { url: 'https://cdn.example/sting.mp3' },
    });
    const blank = createOverlayAlert({
      type: 'follow',
      overlayId: 'lab',
      payload: follow,
      sound: { url: '   ' },
    });
    const http = createOverlayAlert({
      type: 'follow',
      overlayId: 'lab',
      payload: follow,
      sound: { url: 'http://cdn.example/sting.mp3' },
    });
    expect(withSound.ok).toBe(true);
    expect(blank.ok).toBe(true);
    expect(http.ok).toBe(false);
    if (!withSound.ok || !blank.ok) {
      return;
    }
    expect(withSound.alert.sound).toEqual({ url: 'https://cdn.example/sting.mp3', volumeDb: 0 });
    expect(blank.alert.sound).toBeUndefined();
  });
});
