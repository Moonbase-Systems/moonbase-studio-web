import {
  type OverlayEventMessage,
  type OverlayEventPort,
  parseOverlayEventMessage,
} from '../../application/overlay-event-port';

export const OVERLAY_EVENT_CHANNEL = 'moonbase-overlay-events';

/** Cross-tab transport. The same page does not hear its own BroadcastChannel posts. */
export const createBroadcastOverlayEventPort = (): OverlayEventPort => {
  if (typeof BroadcastChannel === 'undefined') {
    return {
      name: 'unavailable',
      available: false,
      publish() {
        return undefined;
      },
      subscribe() {
        return () => undefined;
      },
    };
  }
  const channel = new BroadcastChannel(OVERLAY_EVENT_CHANNEL);
  const listeners = new Set<(message: OverlayEventMessage) => void>();
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const parsed = parseOverlayEventMessage(event.data);
    if (!parsed) {
      return;
    }
    for (const listener of listeners) {
      listener(parsed);
    }
  };
  return {
    name: 'broadcast',
    available: true,
    publish(message) {
      const parsed = parseOverlayEventMessage(message);
      if (!parsed) {
        return;
      }
      channel.postMessage(parsed);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
