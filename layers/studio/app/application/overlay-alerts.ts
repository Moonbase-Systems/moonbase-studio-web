import { z } from 'zod';

import {
  OVERLAY_ALERT_TYPES,
  OVERLAY_VOLUME_DB_MAX,
  OVERLAY_VOLUME_DB_MIN,
  type OverlayAlertType,
  type OverlayCueEvent,
} from '../models/overlay-sound.domain';
import type { OverlayCue } from './overlay-cues';

const plain = (max: number, required: boolean) =>
  z.preprocess(
    (value) =>
      typeof value === 'string'
        ? [...value]
            .filter((char) => {
              const code = char.charCodeAt(0);
              return code > 31 && code !== 127 && char !== '<' && char !== '>';
            })
            .join('')
            .trim()
        : value,
    required ? z.string().min(1).max(max) : z.string().max(max),
  );

const avatarUrl = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z
    .string()
    .max(500)
    .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), 'avatar URL must be http(s)'),
);

const whole = (min: number, max: number) =>
  z.preprocess(
    (value) => (typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : value),
    z.number().int().min(min).max(max),
  );

const followPayload = z
  .object({
    username: plain(64, true),
    displayName: plain(64, true),
    avatarUrl,
  })
  .strict();

const subscriptionPayload = z
  .object({
    username: plain(64, true),
    plan: plain(32, true),
    months: whole(1, 120),
    message: plain(280, false),
  })
  .strict();

const donationPayload = z
  .object({
    username: plain(64, true),
    amount: z.number().finite().min(0).max(1_000_000_000),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/)
      .transform((value) => value.toUpperCase()),
    message: plain(280, false),
  })
  .strict();

const raidPayload = z
  .object({
    username: plain(64, true),
    viewerCount: whole(0, 10_000_000),
  })
  .strict();

const cheerPayload = z
  .object({
    username: plain(64, true),
    amount: whole(1, 1_000_000),
    message: plain(280, false),
  })
  .strict();

const chatPayload = z
  .object({
    username: plain(64, true),
    message: plain(280, true),
  })
  .strict();

const customPayload = z
  .object({
    title: plain(64, true),
    message: plain(280, false),
  })
  .strict();

const payloadSchemas = {
  follow: followPayload,
  subscription: subscriptionPayload,
  donation: donationPayload,
  raid: raidPayload,
  cheer: cheerPayload,
  chat: chatPayload,
  custom: customPayload,
} as const;

export type FollowPayload = z.infer<typeof followPayload>;
export type SubscriptionPayload = z.infer<typeof subscriptionPayload>;
export type DonationPayload = z.infer<typeof donationPayload>;
export type RaidPayload = z.infer<typeof raidPayload>;
export type CheerPayload = z.infer<typeof cheerPayload>;
export type ChatPayload = z.infer<typeof chatPayload>;
export type CustomPayload = z.infer<typeof customPayload>;

/** A file carried by one alert. The overlay page does not play it; Studio does, on the overlay bus. */
export type OverlayAlertSound = {
  url: string;
  volumeDb: number;
};

type AlertBase = { id: string; timestamp: number; overlayId: string; sound?: OverlayAlertSound };

export type OverlayAlert =
  | (AlertBase & { type: 'follow'; payload: FollowPayload })
  | (AlertBase & { type: 'subscription'; payload: SubscriptionPayload })
  | (AlertBase & { type: 'donation'; payload: DonationPayload })
  | (AlertBase & { type: 'raid'; payload: RaidPayload })
  | (AlertBase & { type: 'cheer'; payload: CheerPayload })
  | (AlertBase & { type: 'chat'; payload: ChatPayload })
  | (AlertBase & { type: 'custom'; payload: CustomPayload });

const overlayIdSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_-]{1,64}$/);

const alertSoundSchema = z
  .object({
    url: z
      .string()
      .trim()
      .max(500)
      .refine((value) => /^https:\/\/\S+$/i.test(value), 'sound URL must be https'),
    volumeDb: z.number().finite().min(OVERLAY_VOLUME_DB_MIN).max(OVERLAY_VOLUME_DB_MAX).default(0),
  })
  .strict();

const alertRecord = <const T extends OverlayAlertType, S extends z.ZodType>(type: T, payload: S) =>
  z
    .object({
      id: z.string().min(1).max(80),
      timestamp: z.number().finite(),
      overlayId: overlayIdSchema,
      type: z.literal(type),
      payload,
      sound: alertSoundSchema.optional(),
    })
    .strict();

const alertSchema = z.discriminatedUnion('type', [
  alertRecord('follow', followPayload),
  alertRecord('subscription', subscriptionPayload),
  alertRecord('donation', donationPayload),
  alertRecord('raid', raidPayload),
  alertRecord('cheer', cheerPayload),
  alertRecord('chat', chatPayload),
  alertRecord('custom', customPayload),
]);

export const parseOverlayAlert = (value: unknown): OverlayAlert | null => {
  const parsed = alertSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const issueLines = (error: z.ZodError): string[] =>
  error.issues.map((issue) => `${issue.path.join('.') || 'payload'}: ${issue.message}`);

export const createOverlayEventId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return uuid;
  }
  return `overlay-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const isOverlayAlertType = (value: string): value is OverlayAlertType =>
  (OVERLAY_ALERT_TYPES as readonly string[]).includes(value);

const parseAlertSound = (
  sound: { url: string; volumeDb?: number } | undefined,
): { ok: true; sound?: OverlayAlertSound } | { ok: false; issues: string[] } => {
  if (!sound || sound.url.trim() === '') {
    return { ok: true };
  }
  const parsed = alertSoundSchema.safeParse({
    url: sound.url,
    ...(sound.volumeDb === undefined ? {} : { volumeDb: sound.volumeDb }),
  });
  if (!parsed.success) {
    return { ok: false, issues: issueLines(parsed.error).map((line) => `sound.${line}`) };
  }
  return { ok: true, sound: parsed.data };
};

export const createOverlayAlert = (input: {
  type: string;
  overlayId: string;
  payload: unknown;
  now?: number;
  id?: string;
  /** Omitted or a blank URL means the alert carries no sound. */
  sound?: { url: string; volumeDb?: number };
}): { ok: true; alert: OverlayAlert } | { ok: false; issues: string[] } => {
  if (!isOverlayAlertType(input.type)) {
    return { ok: false, issues: ['type: unknown event'] };
  }
  const payload = payloadSchemas[input.type].safeParse(input.payload);
  const overlayId = overlayIdSchema.safeParse(input.overlayId);
  const sound = parseAlertSound(input.sound);
  const issues = [
    ...(payload.success ? [] : issueLines(payload.error)),
    ...(overlayId.success ? [] : issueLines(overlayId.error).map((line) => `overlayId: ${line}`)),
    ...(sound.ok ? [] : sound.issues),
  ];
  if (!payload.success || !overlayId.success || !sound.ok) {
    return { ok: false, issues };
  }
  const alert = parseOverlayAlert({
    id: input.id ?? createOverlayEventId(),
    timestamp: input.now ?? Date.now(),
    overlayId: overlayId.data,
    type: input.type,
    payload: payload.data,
    ...(sound.sound ? { sound: sound.sound } : {}),
  });
  if (!alert) {
    return { ok: false, issues: ['alert: invalid'] };
  }
  return { ok: true, alert };
};

/** The cue carries the alert type. Scene scope comes from the studio that receives it. */
export const cueForAlert = (alert: OverlayAlert, sceneId: string | null): OverlayCue => {
  const event: OverlayCueEvent = alert.type;
  return sceneId ? { event, sceneId } : { event };
};

export const safeAvatarUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500 || !/^https?:\/\/\S+$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
};

export const alertText = (alert: OverlayAlert): { name: string; line: string; avatarUrl: string | null } => {
  switch (alert.type) {
    case 'follow':
      return {
        name: alert.payload.displayName,
        line: alert.payload.displayName === alert.payload.username ? '' : alert.payload.username,
        avatarUrl: safeAvatarUrl(alert.payload.avatarUrl),
      };
    case 'subscription':
      return {
        name: alert.payload.username,
        line: [alert.payload.plan, String(alert.payload.months), alert.payload.message].filter(Boolean).join(' · '),
        avatarUrl: null,
      };
    case 'donation':
      return {
        name: alert.payload.username,
        line: [`${alert.payload.amount} ${alert.payload.currency}`, alert.payload.message].filter(Boolean).join(' · '),
        avatarUrl: null,
      };
    case 'raid':
      return { name: alert.payload.username, line: String(alert.payload.viewerCount), avatarUrl: null };
    case 'cheer':
      return {
        name: alert.payload.username,
        line: [String(alert.payload.amount), alert.payload.message].filter(Boolean).join(' · '),
        avatarUrl: null,
      };
    case 'chat':
      return { name: alert.payload.username, line: alert.payload.message, avatarUrl: null };
    case 'custom':
      return { name: alert.payload.title, line: alert.payload.message, avatarUrl: null };
  }
};
