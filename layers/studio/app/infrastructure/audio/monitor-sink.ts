export type MonitorSinkResult =
  | { ok: true; sinkId: string }
  | { ok: false; reason: 'unsupported' }
  | { ok: false; reason: 'failed'; message: string };

type SinkContext = object;

/**
 * Moves headphone playback only. The program MediaStreamDestination is not a parameter,
 * so this cannot retarget the stream that leaves the master.
 */
export const applyMonitorSink = async (context: SinkContext, sinkId: string): Promise<MonitorSinkResult> => {
  const setSinkId =
    'setSinkId' in context && typeof context.setSinkId === 'function'
      ? (context.setSinkId as (id: string) => Promise<void>)
      : undefined;
  if (!setSinkId) {
    return { ok: false, reason: 'unsupported' };
  }
  try {
    await setSinkId.call(context, sinkId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'setSinkId failed';
    return { ok: false, reason: 'failed', message };
  }
  return { ok: true, sinkId };
};
