import type { OverlayEventPort } from '../application/overlay-event-port';
import { createBroadcastOverlayEventPort } from '../infrastructure/overlay/broadcast-overlay-event-port';

let port: OverlayEventPort | null = null;

/** One port per page. Another tab gets its own module and the same channel name. */
export const getOverlayEventPort = (): OverlayEventPort => {
  port ??= createBroadcastOverlayEventPort();
  return port;
};
