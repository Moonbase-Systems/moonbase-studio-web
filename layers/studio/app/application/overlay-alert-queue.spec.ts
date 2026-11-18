import { describe, expect, it } from 'vitest';

import {
  ALERT_EXIT_MS,
  ALERT_HOLD_MS,
  ALERT_QUEUE_CAP,
  clearAlertQueue,
  emptyAlertQueue,
  pushAlert,
  tickAlertQueue,
} from './overlay-alert-queue';
import { createOverlayAlert, type OverlayAlert } from './overlay-alerts';

const alert = (index: number): OverlayAlert => {
  const created = createOverlayAlert({
    type: 'follow',
    overlayId: 'lab',
    payload: { username: 'moonbase', displayName: `Fan ${index}`, avatarUrl: '' },
    now: index,
    id: `alert-${index}`,
  });
  if (!created.ok) {
    throw new Error('fixture');
  }
  return created.alert;
};

describe('overlay alert queue', () => {
  it('shows one alert and holds the rest until the visible one leaves', () => {
    let state = emptyAlertQueue();
    state = pushAlert(state, alert(1), 0);
    state = pushAlert(state, alert(2), 0);
    state = pushAlert(state, alert(3), 0);
    expect(state.current?.id).toBe('alert-1');
    expect(state.pending.map((item) => item.id)).toEqual(['alert-2', 'alert-3']);
    expect(tickAlertQueue(state, ALERT_HOLD_MS - 1)).toBe(state);

    const leaving = tickAlertQueue(state, ALERT_HOLD_MS);
    expect(leaving.phase).toBe('leaving');
    expect(leaving.current?.id).toBe('alert-1');

    const next = tickAlertQueue(leaving, ALERT_HOLD_MS + ALERT_EXIT_MS);
    expect(next.current?.id).toBe('alert-2');
    expect(next.pending.map((item) => item.id)).toEqual(['alert-3']);
    expect(next.phase).toBe('visible');
  });

  it('clears the visible alert and the queue', () => {
    const queued = pushAlert(pushAlert(emptyAlertQueue(), alert(1), 0), alert(2), 0);
    expect(clearAlertQueue()).toEqual(emptyAlertQueue());
    expect(queued.pending).toHaveLength(1);
  });

  it('stops accepting alerts past the queue cap', () => {
    let state = pushAlert(emptyAlertQueue(), alert(0), 0);
    for (let index = 1; index <= ALERT_QUEUE_CAP + 5; index += 1) {
      state = pushAlert(state, alert(index), 0);
    }
    expect(state.pending).toHaveLength(ALERT_QUEUE_CAP);
  });

  it('ignores an alert aimed at another overlay before it reaches the queue', () => {
    const other = createOverlayAlert({
      type: 'chat',
      overlayId: 'other',
      payload: { username: 'moonbase', message: 'Cześć' },
      id: 'other-alert',
    });
    expect(other.ok).toBe(true);
    if (!other.ok) {
      return;
    }
    expect(other.alert.overlayId).not.toBe('lab');
  });
});
