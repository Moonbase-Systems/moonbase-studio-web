import { z } from 'zod';

import type { OverlayMonitoringMode } from '../models/overlay-sound.domain';
import { type OverlayAlert, parseOverlayAlert } from './overlay-alerts';

export const OVERLAY_AUDIO_LOG_CODES = [
  'event-received',
  'trigger-matched',
  'trigger-miss',
  'playback-started',
  'playback-queued',
  'playback-ignored',
  'playback-error',
  'playback-completed',
  'signal',
  'program-route',
  'monitor-route',
] as const;

export type OverlayAudioLogCode = (typeof OVERLAY_AUDIO_LOG_CODES)[number];

export type OverlayAudioLogMeta = {
  event?: string;
  soundName?: string;
  outcome?: string;
  loop?: boolean;
  restartPolicy?: string;
  cooldownMs?: number;
  maxInstances?: number;
};

export type OverlayAudioLogEntry = {
  id: string;
  at: number;
  code: OverlayAudioLogCode;
  status: 'ok' | 'warn' | 'error';
  detail: string;
  meta: OverlayAudioLogMeta;
};

export type OverlayAudioStatus = {
  engineReady: boolean;
  busMuted: boolean;
  busSolo: boolean;
  monitoring: OverlayMonitoringMode;
  program: boolean;
  monitor: boolean;
  faderDb: number;
  rmsDb: number;
  peakDb: number;
  activeInstances: number;
  queued: number;
  lastSoundName: string | null;
  lastOutcome: string | null;
  masterMuted: boolean;
  masterVolume: number;
  masterRmsDb: number;
  effectCount: number;
  chainError: string | null;
};

export type StudioLabRequest =
  | { name: 'overlay-mute'; muted: boolean }
  | { name: 'overlay-monitoring'; monitoring: OverlayMonitoringMode }
  | { name: 'master-mute'; muted: boolean }
  | { name: 'master-volume'; volume: number }
  | { name: 'stop-all' };

export type OverlayEventMessage =
  | { kind: 'alert'; alert: OverlayAlert }
  | { kind: 'presence'; role: 'studio' | 'renderer' | 'lab'; overlayId: string; at: number }
  | {
      kind: 'renderer';
      overlayId: string;
      phase: 'idle' | 'visible' | 'leaving';
      alert: OverlayAlert | null;
      queued: number;
      at: number;
    }
  | { kind: 'clear-queue'; overlayId: string; at: number }
  | { kind: 'audio'; status: OverlayAudioStatus; at: number }
  | { kind: 'audio-log'; entry: OverlayAudioLogEntry }
  | { kind: 'studio-request'; request: StudioLabRequest; at: number };

export type OverlayEventPort = {
  readonly name: string;
  readonly available: boolean;
  publish: (message: OverlayEventMessage) => void;
  subscribe: (listener: (message: OverlayEventMessage) => void) => () => void;
};

const overlayId = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]{1,64}$/);

const logMeta = z
  .object({
    event: z.string().max(64).optional(),
    soundName: z.string().max(64).optional(),
    outcome: z.string().max(64).optional(),
    loop: z.boolean().optional(),
    restartPolicy: z.string().max(16).optional(),
    cooldownMs: z.number().optional(),
    maxInstances: z.number().optional(),
  })
  .strict();

const logEntry = z
  .object({
    id: z.string().min(1).max(80),
    at: z.number().finite(),
    code: z.enum(OVERLAY_AUDIO_LOG_CODES),
    status: z.enum(['ok', 'warn', 'error']),
    detail: z.string().max(200),
    meta: logMeta,
  })
  .strict();

const audioStatus = z
  .object({
    engineReady: z.boolean(),
    busMuted: z.boolean(),
    busSolo: z.boolean(),
    monitoring: z.enum(['off', 'monitor', 'monitor-and-output']),
    program: z.boolean(),
    monitor: z.boolean(),
    faderDb: z.number().finite(),
    rmsDb: z.number().finite(),
    peakDb: z.number().finite(),
    activeInstances: z.number().int().nonnegative(),
    queued: z.number().int().nonnegative(),
    lastSoundName: z.string().max(64).nullable(),
    lastOutcome: z.string().max(64).nullable(),
    masterMuted: z.boolean(),
    masterVolume: z.number().finite(),
    masterRmsDb: z.number().finite(),
    effectCount: z.number().int().nonnegative(),
    chainError: z.string().max(200).nullable(),
  })
  .strict();

const studioRequest = z.discriminatedUnion('name', [
  z.object({ name: z.literal('overlay-mute'), muted: z.boolean() }).strict(),
  z
    .object({
      name: z.literal('overlay-monitoring'),
      monitoring: z.enum(['off', 'monitor', 'monitor-and-output']),
    })
    .strict(),
  z.object({ name: z.literal('master-mute'), muted: z.boolean() }).strict(),
  z.object({ name: z.literal('master-volume'), volume: z.number().min(0).max(1) }).strict(),
  z.object({ name: z.literal('stop-all') }).strict(),
]);

const alertMessage = z
  .object({
    kind: z.literal('alert'),
    alert: z.unknown(),
  })
  .strict();

const messageSchema = z.discriminatedUnion('kind', [
  alertMessage,
  z
    .object({
      kind: z.literal('presence'),
      role: z.enum(['studio', 'renderer', 'lab']),
      overlayId,
      at: z.number().finite(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('renderer'),
      overlayId,
      phase: z.enum(['idle', 'visible', 'leaving']),
      alert: z.unknown().nullable(),
      queued: z.number().int().min(0).max(64),
      at: z.number().finite(),
    })
    .strict(),
  z.object({ kind: z.literal('clear-queue'), overlayId, at: z.number().finite() }).strict(),
  z.object({ kind: z.literal('audio'), status: audioStatus, at: z.number().finite() }).strict(),
  z.object({ kind: z.literal('audio-log'), entry: logEntry }).strict(),
  z.object({ kind: z.literal('studio-request'), request: studioRequest, at: z.number().finite() }).strict(),
]);

export const parseOverlayEventMessage = (value: unknown): OverlayEventMessage | null => {
  const parsed = messageSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  const message = parsed.data;
  if (message.kind === 'alert') {
    const alert = parseOverlayAlert(message.alert);
    return alert ? { kind: 'alert', alert } : null;
  }
  if (message.kind === 'renderer') {
    if (message.alert === null) {
      return { ...message, alert: null };
    }
    const alert = parseOverlayAlert(message.alert);
    return alert ? { ...message, alert } : null;
  }
  return message;
};

export const createMemoryOverlayEventPort = (options?: { available?: boolean; name?: string }): OverlayEventPort => {
  const listeners = new Set<(message: OverlayEventMessage) => void>();
  return {
    name: options?.name ?? 'memory',
    available: options?.available ?? true,
    publish(message) {
      const parsed = parseOverlayEventMessage(message);
      if (!parsed) {
        return;
      }
      for (const listener of [...listeners]) {
        listener(parsed);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
