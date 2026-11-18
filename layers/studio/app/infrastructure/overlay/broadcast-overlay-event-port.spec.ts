import { describe, expect, it, vi } from 'vitest';

import { createOverlayAlert } from '../../application/overlay-alerts';
import { createBroadcastOverlayEventPort } from './broadcast-overlay-event-port';

describe('broadcast overlay events', () => {
  it('delivers an alert to another channel and stops when that channel unsubscribes', async () => {
    const left = createBroadcastOverlayEventPort();
    const right = createBroadcastOverlayEventPort();
    expect(left.available).toBe(true);
    const heard = vi.fn();
    const stop = right.subscribe(heard);
    const created = createOverlayAlert({
      type: 'donation',
      overlayId: 'lab',
      payload: { username: 'moonbase', amount: 5, currency: 'pln', message: 'Dzięki' },
      id: 'donation-1',
      now: 3,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    left.publish({ kind: 'alert', alert: created.alert });
    await vi.waitFor(() => expect(heard).toHaveBeenCalledTimes(1));
    expect(heard.mock.calls[0]?.[0]).toMatchObject({ kind: 'alert', alert: { payload: { currency: 'PLN' } } });
    stop();
    left.publish({ kind: 'clear-queue', overlayId: 'lab', at: 9 });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
