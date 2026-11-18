import { describe, expect, it, vi } from 'vitest';

import { createOverlayAlert } from './overlay-alerts';
import { createMemoryOverlayEventPort, parseOverlayEventMessage } from './overlay-event-port';

const follow = () => {
  const created = createOverlayAlert({
    type: 'follow',
    overlayId: 'lab',
    payload: { username: 'moonbase', displayName: 'MoonBase', avatarUrl: '' },
    now: 1,
    id: 'follow-1',
  });
  if (!created.ok) {
    throw new Error('fixture');
  }
  return created.alert;
};

describe('overlay event port', () => {
  it('delivers a validated alert and drops a message with extra fields', () => {
    const port = createMemoryOverlayEventPort();
    const heard = vi.fn();
    port.subscribe(heard);
    port.publish({ kind: 'alert', alert: follow() });
    port.publish({ kind: 'alert', alert: follow(), extra: true } as never);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(parseOverlayEventMessage({ kind: 'clear-queue', overlayId: 'lab', at: 1, html: '<b>' })).toBeNull();
  });

  it('stops delivery after unsubscribe and still reaches the other listener', () => {
    const port = createMemoryOverlayEventPort();
    const first = vi.fn();
    const second = vi.fn();
    const stop = port.subscribe(first);
    port.subscribe(second);
    stop();
    port.publish({ kind: 'clear-queue', overlayId: 'lab', at: 4 });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps an unavailable memory port local without claiming cross-tab delivery', () => {
    const port = createMemoryOverlayEventPort({ available: false, name: 'memory' });
    const heard = vi.fn();
    port.subscribe(heard);
    port.publish({ kind: 'presence', role: 'renderer', overlayId: 'lab', at: 2 });
    expect(port.available).toBe(false);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
