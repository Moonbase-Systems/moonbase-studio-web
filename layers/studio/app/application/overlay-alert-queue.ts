import type { OverlayAlert } from './overlay-alerts';

export const ALERT_HOLD_MS = 4000;
export const ALERT_EXIT_MS = 280;
export const ALERT_QUEUE_CAP = 32;

export type AlertQueuePhase = 'idle' | 'visible' | 'leaving';

export type AlertQueueState = {
  current: OverlayAlert | null;
  pending: OverlayAlert[];
  phase: AlertQueuePhase;
  phaseUntil: number;
};

export const emptyAlertQueue = (): AlertQueueState => ({
  current: null,
  pending: [],
  phase: 'idle',
  phaseUntil: 0,
});

/** One alert is visible. The rest wait, and the queue stops growing at the cap. */
export const pushAlert = (state: AlertQueueState, alert: OverlayAlert, now: number): AlertQueueState => {
  if (!state.current || state.phase === 'idle') {
    return { current: alert, pending: [], phase: 'visible', phaseUntil: now + ALERT_HOLD_MS };
  }
  if (state.pending.length >= ALERT_QUEUE_CAP) {
    return state;
  }
  return { ...state, pending: [...state.pending, alert] };
};

export const tickAlertQueue = (state: AlertQueueState, now: number): AlertQueueState => {
  if (state.phase === 'visible' && state.current && now >= state.phaseUntil) {
    return { ...state, phase: 'leaving', phaseUntil: now + ALERT_EXIT_MS };
  }
  if (state.phase === 'leaving' && now >= state.phaseUntil) {
    const [next, ...pending] = state.pending;
    if (!next) {
      return emptyAlertQueue();
    }
    return { current: next, pending, phase: 'visible', phaseUntil: now + ALERT_HOLD_MS };
  }
  return state;
};

export const clearAlertQueue = (): AlertQueueState => emptyAlertQueue();
