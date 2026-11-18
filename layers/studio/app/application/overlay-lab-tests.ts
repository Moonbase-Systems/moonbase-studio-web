import { LEVEL_FLOOR_DB } from '../models/audio.domain';
import type { OverlayAudioLogEntry, OverlayAudioStatus } from './overlay-event-port';

export const OVERLAY_LAB_TEST_IDS = [
  'play',
  'multiple',
  'rapid',
  'loop',
  'stop-all',
  'cooldown',
  'max-instances',
  'restart',
  'overlay-mute',
  'master-mute',
  'master-volume',
  'effects',
  'program',
  'monitoring',
] as const;

export type OverlayLabTestId = (typeof OVERLAY_LAB_TEST_IDS)[number];

export type LabVerdict = {
  state: 'pass' | 'fail' | 'manual';
  code: string;
};

export type OverlayLabSample = {
  studioConnected: boolean;
  sent: number;
  log: readonly OverlayAudioLogEntry[];
  status: OverlayAudioStatus | null;
};

const count = (log: readonly OverlayAudioLogEntry[], code: OverlayAudioLogEntry['code']) =>
  log.filter((entry) => entry.code === code).length;

const outcomes = (log: readonly OverlayAudioLogEntry[]) =>
  log.filter((entry) =>
    ['playback-started', 'playback-queued', 'playback-ignored', 'playback-error'].includes(entry.code),
  );

const startedMeta = (log: readonly OverlayAudioLogEntry[]) =>
  log.find((entry) => entry.code === 'playback-started')?.meta;

const verdict = (state: LabVerdict['state'], code: string): LabVerdict => ({ state, code });

const offline = (sample: OverlayLabSample): LabVerdict | null =>
  sample.studioConnected ? null : verdict('fail', 'studio-offline');

export const evaluateOverlayLabTest = (id: OverlayLabTestId, sample: OverlayLabSample): LabVerdict => {
  const disconnected = offline(sample);
  if (disconnected) {
    return disconnected;
  }
  const started = count(sample.log, 'playback-started');
  const queued = count(sample.log, 'playback-queued');
  const ignored = count(sample.log, 'playback-ignored');
  const errors = count(sample.log, 'playback-error');
  const misses = count(sample.log, 'trigger-miss');
  const meta = startedMeta(sample.log);
  const status = sample.status;

  if (id === 'play') {
    if (started > 0) {
      return verdict('pass', 'playback-started');
    }
    if (queued > 0) {
      return verdict('pass', 'playback-queued');
    }
    if (errors > 0) {
      return verdict('fail', 'playback-error');
    }
    if (ignored > 0) {
      return verdict('fail', 'playback-ignored');
    }
    if (misses > 0) {
      return verdict('fail', 'no-trigger');
    }
    return verdict('fail', 'no-trace');
  }

  if (id === 'multiple') {
    if (started + queued >= 2) {
      return verdict('pass', 'multiple-started');
    }
    if (started >= 1 && ignored >= 1) {
      return verdict('pass', 'multiple-capped');
    }
    if (started === 0 && misses > 0) {
      return verdict('fail', 'no-trigger');
    }
    if (errors > 0 && started === 0) {
      return verdict('fail', 'playback-error');
    }
    return verdict('fail', 'multiple-short');
  }

  if (id === 'rapid') {
    const received = count(sample.log, 'event-received');
    if (received < sample.sent) {
      return verdict('fail', 'rapid-short');
    }
    if (started >= 1) {
      return verdict('pass', 'rapid-handled');
    }
    if (misses > 0) {
      return verdict('fail', 'no-trigger');
    }
    if (errors > 0) {
      return verdict('fail', 'playback-error');
    }
    return verdict('fail', 'playback-ignored');
  }

  if (id === 'cooldown') {
    const second = outcomes(sample.log)[1];
    const cooldown = second?.meta.cooldownMs ?? meta?.cooldownMs ?? 0;
    if (!second && misses > 0) {
      return verdict('fail', 'no-trigger');
    }
    if (cooldown > 0 && second?.code === 'playback-ignored') {
      return verdict('pass', 'cooldown-rejected');
    }
    if (cooldown > 0 && second?.code === 'playback-started') {
      return verdict('fail', 'cooldown-missed');
    }
    if (cooldown === 0 && started >= 2) {
      return verdict('manual', 'cooldown-unset');
    }
    return verdict('fail', 'no-trace');
  }

  if (id === 'max-instances') {
    if (started > 0 && (ignored > 0 || queued > 0)) {
      return verdict('pass', 'instances-capped');
    }
    const cap = meta?.maxInstances ?? 0;
    if (started >= sample.sent && cap >= sample.sent) {
      return verdict('manual', 'instances-open');
    }
    if (started === 0 && misses > 0) {
      return verdict('fail', 'no-trigger');
    }
    return verdict('fail', 'no-trace');
  }

  if (id === 'restart') {
    const policy = meta?.restartPolicy ?? outcomes(sample.log)[0]?.meta.restartPolicy;
    if (policy !== 'restart') {
      return started > 0 || misses === 0 ? verdict('manual', 'restart-other') : verdict('fail', 'no-trigger');
    }
    if (started >= 1 && (status?.activeInstances ?? 0) <= 1) {
      return verdict('pass', 'restart-held');
    }
    if ((status?.activeInstances ?? 0) > 1) {
      return verdict('fail', 'restart-grew');
    }
    return verdict('fail', 'no-trigger');
  }

  if (id === 'loop') {
    if (meta?.loop) {
      return verdict('manual', 'loop-on');
    }
    if (started > 0) {
      return verdict('manual', 'loop-off');
    }
    return misses > 0 ? verdict('fail', 'no-trigger') : verdict('fail', 'no-trace');
  }

  if (id === 'stop-all') {
    if (started > 0 && status && status.activeInstances === 0 && status.queued === 0) {
      return verdict('pass', 'stopped');
    }
    if (started > 0) {
      return verdict('fail', 'stop-failed');
    }
    return misses > 0 ? verdict('fail', 'no-trigger') : verdict('fail', 'no-trace');
  }

  if (id === 'overlay-mute') {
    if (!status?.busMuted) {
      return verdict('fail', 'mute-failed');
    }
    if (started === 0) {
      return verdict('fail', 'mute-unconfirmed');
    }
    if (status.rmsDb <= LEVEL_FLOOR_DB + 1) {
      return verdict('pass', 'mute-silenced');
    }
    return verdict('fail', 'mute-failed');
  }

  if (id === 'master-mute') {
    return status?.masterMuted ? verdict('pass', 'master-muted') : verdict('fail', 'master-mute-failed');
  }

  if (id === 'master-volume') {
    return status && Math.abs(status.masterVolume - 0.2) < 0.02
      ? verdict('pass', 'master-volume')
      : verdict('fail', 'master-volume-failed');
  }

  if (id === 'effects') {
    if (!status || status.effectCount === 0) {
      return verdict('manual', 'effects-none');
    }
    if (status.chainError) {
      return verdict('fail', 'effects-error');
    }
    if (started > 0) {
      return verdict('pass', 'effects-clean');
    }
    return misses > 0 ? verdict('fail', 'no-trigger') : verdict('fail', 'no-trace');
  }

  if (id === 'program') {
    return status?.program && status.monitor && !status.busMuted
      ? verdict('pass', 'program-on')
      : verdict('fail', 'program-failed');
  }

  return status?.monitoring === 'monitor' && status.monitor && !status.program
    ? verdict('pass', 'monitor-on')
    : verdict('fail', 'monitor-failed');
};
