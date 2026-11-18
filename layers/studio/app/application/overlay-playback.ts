import {
  OVERLAY_QUEUE_CAP,
  type OverlayRestartPolicy,
  type OverlaySceneChangePolicy,
} from '../models/overlay-sound.domain';

export type OverlayRuntimeInstance = {
  id: string;
  soundId: string;
  sceneId: string | null;
  /** Started from an alert URL. A library sync must not stop it. */
  alert?: boolean;
};

export type OverlayQueueEntry = {
  soundId: string;
  sceneId: string | null;
};

export type OverlayPlaybackBook = {
  instances: OverlayRuntimeInstance[];
  queues: Record<string, OverlayQueueEntry[]>;
  lastTriggerAtMs: Record<string, number>;
};

export type OverlayPlayDecision = { kind: 'ignore' } | { kind: 'start'; stopInstanceIds: string[] } | { kind: 'queue' };

export type OverlaySoundRules = {
  id: string;
  enabled: boolean;
  maxInstances: number;
  cooldownMs: number;
  restartPolicy: OverlayRestartPolicy;
};

export const emptyOverlayPlaybackBook = (): OverlayPlaybackBook => ({
  instances: [],
  queues: {},
  lastTriggerAtMs: {},
});

const copyBook = (book: OverlayPlaybackBook): OverlayPlaybackBook => ({
  instances: book.instances.map((item) => ({ ...item })),
  queues: Object.fromEntries(
    Object.entries(book.queues).map(([soundId, entries]) => [soundId, entries.map((entry) => ({ ...entry }))]),
  ),
  lastTriggerAtMs: { ...book.lastTriggerAtMs },
});

const countOf = (book: OverlayPlaybackBook, soundId: string): number =>
  book.instances.filter((item) => item.soundId === soundId).length;

const hasRoom = (book: OverlayPlaybackBook, sound: OverlaySoundRules, busMaxInstances: number): boolean =>
  countOf(book, sound.id) < sound.maxInstances && book.instances.length < busMaxInstances;

/**
 * Cooldown rejects the call before an instance or a queue entry exists.
 * A full bus or a full sound limit ignores the call, except `restart`, which
 * replaces this sound's own voices when one slot will remain.
 */
export const decideOverlayPlay = (input: {
  book: OverlayPlaybackBook;
  sound: OverlaySoundRules;
  busMaxInstances: number;
  nowMs: number;
  sceneId: string | null;
}): OverlayPlayDecision => {
  const { book, sound, busMaxInstances, nowMs } = input;
  if (!sound.enabled) {
    return { kind: 'ignore' };
  }
  const last = book.lastTriggerAtMs[sound.id];
  if (sound.cooldownMs > 0 && last !== undefined && nowMs - last < sound.cooldownMs) {
    return { kind: 'ignore' };
  }

  const own = book.instances.filter((item) => item.soundId === sound.id);
  if (sound.restartPolicy === 'ignore' && own.length > 0) {
    return { kind: 'ignore' };
  }
  if (sound.restartPolicy === 'restart') {
    const remaining = book.instances.length - own.length;
    if (remaining >= busMaxInstances) {
      return { kind: 'ignore' };
    }
    return { kind: 'start', stopInstanceIds: own.map((item) => item.id) };
  }
  if (hasRoom(book, sound, busMaxInstances)) {
    return { kind: 'start', stopInstanceIds: [] };
  }
  if (sound.restartPolicy === 'queue') {
    const queued = book.queues[sound.id]?.length ?? 0;
    if (queued >= OVERLAY_QUEUE_CAP) {
      return { kind: 'ignore' };
    }
    return { kind: 'queue' };
  }
  return { kind: 'ignore' };
};

export const acceptOverlayPlay = (
  book: OverlayPlaybackBook,
  soundId: string,
  nowMs: number,
  sceneId: string | null,
  decision: OverlayPlayDecision,
): OverlayPlaybackBook => {
  if (decision.kind === 'ignore') {
    return book;
  }
  const next = copyBook(book);
  next.lastTriggerAtMs[soundId] = nowMs;
  if (decision.kind === 'start') {
    const stopping = new Set(decision.stopInstanceIds);
    next.instances = next.instances.filter((item) => !stopping.has(item.id));
    return next;
  }
  const queue = next.queues[soundId] ?? [];
  next.queues[soundId] = [...queue, { soundId, sceneId }];
  return next;
};

export const noteOverlayInstance = (
  book: OverlayPlaybackBook,
  instance: OverlayRuntimeInstance,
): OverlayPlaybackBook => {
  const next = copyBook(book);
  next.instances = [...next.instances, { ...instance }];
  return next;
};

export const dropOverlayInstance = (
  book: OverlayPlaybackBook,
  instanceId: string,
): { book: OverlayPlaybackBook; soundId: string | null } => {
  const found = book.instances.find((item) => item.id === instanceId);
  if (!found) {
    return { book, soundId: null };
  }
  const next = copyBook(book);
  next.instances = next.instances.filter((item) => item.id !== instanceId);
  return { book: next, soundId: found.soundId };
};

/** The next queued call starts only when both the sound limit and the bus limit have a free slot. */
export const takeQueuedOverlay = (
  book: OverlayPlaybackBook,
  sound: OverlaySoundRules,
  busMaxInstances: number,
): { book: OverlayPlaybackBook; entry: OverlayQueueEntry | null } => {
  const queue = book.queues[sound.id] ?? [];
  if (queue.length === 0 || !sound.enabled || !hasRoom(book, sound, busMaxInstances)) {
    return { book, entry: null };
  }
  const next = copyBook(book);
  const [entry, ...rest] = next.queues[sound.id] ?? [];
  next.queues[sound.id] = rest ?? [];
  return { book: next, entry: entry ?? null };
};

export const clearOverlayQueue = (book: OverlayPlaybackBook, soundId: string): OverlayPlaybackBook => {
  if (!book.queues[soundId]?.length) {
    return book;
  }
  const next = copyBook(book);
  next.queues[soundId] = [];
  return next;
};

export const stopAllOverlayPlayback = (
  book: OverlayPlaybackBook,
): { book: OverlayPlaybackBook; stoppedIds: string[] } => ({
  book: emptyOverlayPlaybackBook(),
  stoppedIds: book.instances.map((item) => item.id),
});

export const overlayStopsForSceneChange = (
  policy: OverlaySceneChangePolicy,
  book: OverlayPlaybackBook,
  previousSceneId: string,
): { stoppedIds: string[]; book: OverlayPlaybackBook } => {
  if (policy === 'continue') {
    return { stoppedIds: [], book };
  }
  if (policy === 'stop-all-overlay-sounds') {
    return stopAllOverlayPlayback(book);
  }
  const stoppedIds = book.instances.filter((item) => item.sceneId === previousSceneId).map((item) => item.id);
  const next = copyBook(book);
  next.instances = next.instances.filter((item) => item.sceneId !== previousSceneId);
  for (const [soundId, entries] of Object.entries(next.queues)) {
    next.queues[soundId] = entries.filter((entry) => entry.sceneId !== previousSceneId);
  }
  return { stoppedIds, book: next };
};
