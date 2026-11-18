import { LEVEL_FLOOR_DB } from '../models/audio.domain';
import type { OverlayCueTrace } from './overlay-cue-trace';
import type { OverlayAudioLogEntry, OverlayAudioStatus } from './overlay-event-port';

const metaFrom = (outcome: OverlayCueTrace['outcomes'][number], event: string): OverlayAudioLogEntry['meta'] => ({
  event,
  soundName: outcome.name,
  outcome: outcome.outcome,
  loop: outcome.loop,
  restartPolicy: outcome.restartPolicy,
  cooldownMs: outcome.cooldownMs,
  maxInstances: outcome.maxInstances,
});

const codeFor = (
  outcome: OverlayCueTrace['outcomes'][number]['outcome'],
): { code: OverlayAudioLogEntry['code']; status: OverlayAudioLogEntry['status'] } => {
  if (outcome === 'started') {
    return { code: 'playback-started', status: 'ok' };
  }
  if (outcome === 'queued') {
    return { code: 'playback-queued', status: 'warn' };
  }
  if (outcome === 'ignored') {
    return { code: 'playback-ignored', status: 'warn' };
  }
  return { code: 'playback-error', status: 'error' };
};

/** One cue becomes the audio log lines Studio publishes. */
export const audioEntriesFromTrace = (trace: OverlayCueTrace): Omit<OverlayAudioLogEntry, 'id'>[] => {
  const received: Omit<OverlayAudioLogEntry, 'id'> = {
    at: trace.at,
    code: 'event-received',
    status: 'ok',
    detail: trace.event,
    meta: { event: trace.event },
  };
  if (trace.matched === 0) {
    return [
      received,
      {
        at: trace.at,
        code: 'trigger-miss',
        status: 'warn',
        detail: trace.event,
        meta: { event: trace.event },
      },
    ];
  }
  const names = trace.outcomes.map((item) => item.name).join(', ');
  const matched: Omit<OverlayAudioLogEntry, 'id'> = {
    at: trace.at,
    code: 'trigger-matched',
    status: 'ok',
    detail: names.slice(0, 200),
    meta: { event: trace.event, soundName: names.slice(0, 64) },
  };
  const outcomes = trace.outcomes.map((item) => {
    const coded = codeFor(item.outcome);
    return {
      at: trace.at,
      code: coded.code,
      status: coded.status,
      detail: item.name,
      meta: metaFrom(item, trace.event),
    };
  });
  return [received, matched, ...outcomes];
};

export const audioEntryFromNotice = (notice: { at: number; soundName: string }): Omit<OverlayAudioLogEntry, 'id'> => ({
  at: notice.at,
  code: 'playback-completed',
  status: 'ok',
  detail: notice.soundName,
  meta: { soundName: notice.soundName },
});

const SIGNAL_DB = LEVEL_FLOOR_DB + 3;

/** Edges on the published meter and routing flags. Levels themselves stay on the status message. */
export const audioEntriesFromStatus = (
  previous: OverlayAudioStatus | null,
  next: OverlayAudioStatus,
): Omit<OverlayAudioLogEntry, 'id'>[] => {
  const entries: Omit<OverlayAudioLogEntry, 'id'>[] = [];
  const at = Date.now();
  const wasHot = (previous?.rmsDb ?? LEVEL_FLOOR_DB) > SIGNAL_DB;
  if (!wasHot && next.rmsDb > SIGNAL_DB) {
    entries.push({
      at,
      code: 'signal',
      status: 'ok',
      detail: `${next.rmsDb.toFixed(1)} dB`,
      meta: {},
    });
  }
  if (next.program && !previous?.program) {
    entries.push({ at, code: 'program-route', status: 'ok', detail: 'program', meta: {} });
  }
  if (next.monitor && !previous?.monitor) {
    entries.push({ at, code: 'monitor-route', status: 'ok', detail: 'monitor', meta: {} });
  }
  return entries;
};
