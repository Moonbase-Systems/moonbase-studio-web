import {
  OVERLAY_VOLUME_DB_MAX,
  OVERLAY_VOLUME_DB_MIN,
  type OverlaySceneChangePolicy,
  type OverlaySound,
} from '../models/overlay-sound.domain';
import {
  acceptOverlayPlay,
  clearOverlayQueue,
  decideOverlayPlay,
  dropOverlayInstance,
  emptyOverlayPlaybackBook,
  noteOverlayInstance,
  type OverlayPlaybackBook,
  type OverlayRuntimeInstance,
  overlayStopsForSceneChange,
  stopAllOverlayPlayback,
  takeQueuedOverlay,
} from './overlay-playback';

export type OverlayPlaybackError = 'missing-bytes' | 'decode-failed';

export type OverlayPlayOutcome = 'started' | 'queued' | 'ignored' | OverlayPlaybackError;

export type OverlayInstanceStart = {
  instanceId: string;
  buffer: unknown;
  volumeDb: number;
  muted: boolean;
  loop: boolean;
  playbackRate: number;
  startTimeSec: number;
  endTimeSec?: number;
};

export type OverlayAudioPort = {
  loadBuffer: (cacheKey: string, url: string) => Promise<unknown>;
  start: (request: OverlayInstanceStart) => void;
  stop: (instanceId: string) => void;
  setGain: (instanceId: string, volumeDb: number, muted: boolean) => void;
  retain: (keys: ReadonlySet<string>) => void;
};

export type OverlayAssetLocation = {
  cacheKey: string;
  url: string;
};

/**
 * Session playback for overlay sounds. The project stores the bus. This object stores
 * voices, cooldowns, and queues, and it never touches Web Audio itself.
 */
export class OverlayPlaybackController {
  private book: OverlayPlaybackBook = emptyOverlayPlaybackBook();
  private chain: Promise<void> = Promise.resolve();
  private ticket = 0;
  private blockedBefore = 0;
  private readonly blockedScenes = new Map<string, number>();
  private readonly cacheKeyByInstance = new Map<string, string>();
  private readonly restartPolicy = new Map<string, OverlaySound['restartPolicy']>();

  constructor(
    private readonly deps: {
      port: OverlayAudioPort;
      now: () => number;
      createId: () => string;
      resolve: (assetId: string) => OverlayAssetLocation | null;
      onChange?: () => void;
      onError?: (error: OverlayPlaybackError) => void;
    },
  ) {}

  get instances(): readonly OverlayRuntimeInstance[] {
    return this.book.instances;
  }

  get queuedCount(): number {
    return Object.values(this.book.queues).reduce((sum, entries) => sum + entries.length, 0);
  }

  play(sound: OverlaySound, sceneId: string | null, busMaxInstances: number): Promise<OverlayPlayOutcome> {
    const ticket = ++this.ticket;
    return this.run(() => this.playNow(sound, sceneId, busMaxInstances, ticket));
  }

  /**
   * One alert file, once. No cooldown and no queue: the sender already decided it should play.
   * A full bus ignores the call. The voice is marked so a library sync does not stop it.
   */
  playUrl(url: string, volumeDb: number, sceneId: string | null, busMaxInstances: number): Promise<OverlayPlayOutcome> {
    const ticket = ++this.ticket;
    return this.run(() => this.playUrlNow(url, volumeDb, sceneId, busMaxInstances, ticket));
  }

  onEnded(instanceId: string, sounds: readonly OverlaySound[], busMaxInstances: number): Promise<void> {
    return this.run(() => this.finish(instanceId, sounds, busMaxInstances));
  }

  stop(instanceId: string, sounds: readonly OverlaySound[], busMaxInstances: number): Promise<void> {
    return this.run(async () => {
      this.deps.port.stop(instanceId);
      await this.finish(instanceId, sounds, busMaxInstances);
    });
  }

  stopAll(): Promise<void> {
    return this.run(async () => {
      this.blockedBefore = this.ticket;
      this.halt(stopAllOverlayPlayback(this.book));
    });
  }

  applySceneChange(policy: OverlaySceneChangePolicy, previousSceneId: string): Promise<void> {
    return this.run(async () => {
      if (policy === 'stop-all-overlay-sounds') {
        this.blockedBefore = this.ticket;
      }
      if (policy === 'stop-scene-sounds') {
        this.blockedScenes.set(previousSceneId, this.ticket);
      }
      this.halt(overlayStopsForSceneChange(policy, this.book, previousSceneId));
    });
  }

  syncSounds(sounds: readonly OverlaySound[]): Promise<void> {
    return this.run(async () => {
      const live = new Map(sounds.map((sound) => [sound.id, sound]));
      for (const sound of sounds) {
        const previous = this.restartPolicy.get(sound.id);
        if ((previous !== undefined && previous !== sound.restartPolicy) || !sound.enabled) {
          this.book = clearOverlayQueue(this.book, sound.id);
        }
        this.restartPolicy.set(sound.id, sound.restartPolicy);
      }
      for (const soundId of [...this.restartPolicy.keys()]) {
        if (!live.has(soundId)) {
          this.restartPolicy.delete(soundId);
          this.book = clearOverlayQueue(this.book, soundId);
        }
      }
      for (const instance of [...this.book.instances]) {
        if (instance.alert) {
          continue;
        }
        const sound = live.get(instance.soundId);
        if (!sound?.enabled) {
          this.releaseInstance(instance.id);
          continue;
        }
        this.deps.port.setGain(instance.id, sound.volumeDb, sound.muted);
      }
      const keep = new Set<string>();
      for (const sound of sounds) {
        const located = this.deps.resolve(sound.assetId);
        if (located) {
          keep.add(located.cacheKey);
        }
      }
      for (const cacheKey of this.cacheKeyByInstance.values()) {
        keep.add(cacheKey);
      }
      this.deps.port.retain(keep);
      this.deps.onChange?.();
    });
  }

  private async finish(instanceId: string, sounds: readonly OverlaySound[], busMaxInstances: number): Promise<void> {
    const dropped = dropOverlayInstance(this.book, instanceId);
    if (!dropped.soundId) {
      return;
    }
    this.book = dropped.book;
    this.cacheKeyByInstance.delete(instanceId);
    this.deps.onChange?.();
    const sound = sounds.find((item) => item.id === dropped.soundId);
    if (!sound?.enabled) {
      return;
    }
    const taken = takeQueuedOverlay(this.book, sound, busMaxInstances);
    this.book = taken.book;
    if (!taken.entry) {
      return;
    }
    await this.startSound(sound, taken.entry.sceneId, this.ticket);
  }

  private async playNow(
    sound: OverlaySound,
    sceneId: string | null,
    busMaxInstances: number,
    ticket: number,
  ): Promise<OverlayPlayOutcome> {
    const nowMs = this.deps.now();
    const decision = decideOverlayPlay({
      book: this.book,
      sound,
      busMaxInstances,
      nowMs,
      sceneId,
    });
    if (decision.kind === 'ignore') {
      return 'ignored';
    }
    this.book = acceptOverlayPlay(this.book, sound.id, nowMs, sceneId, decision);
    if (decision.kind === 'queue') {
      this.deps.onChange?.();
      return 'queued';
    }
    for (const instanceId of decision.stopInstanceIds) {
      this.cacheKeyByInstance.delete(instanceId);
      this.deps.port.stop(instanceId);
    }
    const outcome = await this.startSound(sound, sceneId, ticket);
    return outcome;
  }

  private async playUrlNow(
    url: string,
    volumeDb: number,
    sceneId: string | null,
    busMaxInstances: number,
    ticket: number,
  ): Promise<OverlayPlayOutcome> {
    const trimmed = url.trim();
    if (trimmed.length === 0 || trimmed.length > 500 || !/^https:\/\/\S+$/i.test(trimmed)) {
      this.deps.onError?.('missing-bytes');
      return 'missing-bytes';
    }
    if (this.book.instances.length >= busMaxInstances) {
      return 'ignored';
    }
    let buffer: unknown;
    try {
      buffer = await this.deps.port.loadBuffer(trimmed, trimmed);
    } catch {
      this.deps.onError?.('decode-failed');
      return 'decode-failed';
    }
    if (this.isBlocked(ticket, sceneId) || this.book.instances.length >= busMaxInstances) {
      return 'ignored';
    }
    const instanceId = this.deps.createId();
    const gain = Math.min(OVERLAY_VOLUME_DB_MAX, Math.max(OVERLAY_VOLUME_DB_MIN, volumeDb));
    this.deps.port.start({
      instanceId,
      buffer,
      volumeDb: Number.isFinite(gain) ? gain : 0,
      muted: false,
      loop: false,
      playbackRate: 1,
      startTimeSec: 0,
    });
    this.cacheKeyByInstance.set(instanceId, trimmed);
    this.book = noteOverlayInstance(this.book, { id: instanceId, soundId: 'alert', sceneId, alert: true });
    this.deps.onChange?.();
    return 'started';
  }

  private async startSound(sound: OverlaySound, sceneId: string | null, ticket: number): Promise<OverlayPlayOutcome> {
    const located = this.deps.resolve(sound.assetId);
    if (!located) {
      this.deps.onError?.('missing-bytes');
      return 'missing-bytes';
    }
    let buffer: unknown;
    try {
      buffer = await this.deps.port.loadBuffer(located.cacheKey, located.url);
    } catch {
      this.deps.onError?.('decode-failed');
      return 'decode-failed';
    }
    if (this.isBlocked(ticket, sceneId)) {
      return 'ignored';
    }
    const instanceId = this.deps.createId();
    this.deps.port.start({
      instanceId,
      buffer,
      volumeDb: sound.volumeDb,
      muted: sound.muted,
      loop: sound.loop,
      playbackRate: sound.playbackRate,
      startTimeSec: sound.startTimeSec,
      endTimeSec: sound.endTimeSec,
    });
    this.cacheKeyByInstance.set(instanceId, located.cacheKey);
    this.book = noteOverlayInstance(this.book, { id: instanceId, soundId: sound.id, sceneId });
    this.deps.onChange?.();
    return 'started';
  }

  private isBlocked(ticket: number, sceneId: string | null): boolean {
    if (ticket <= this.blockedBefore) {
      return true;
    }
    if (!sceneId) {
      return false;
    }
    return ticket <= (this.blockedScenes.get(sceneId) ?? 0);
  }

  private releaseInstance(instanceId: string): void {
    this.book = dropOverlayInstance(this.book, instanceId).book;
    this.cacheKeyByInstance.delete(instanceId);
    this.deps.port.stop(instanceId);
  }

  private halt(result: { book: OverlayPlaybackBook; stoppedIds: string[] }): void {
    this.book = result.book;
    for (const instanceId of result.stoppedIds) {
      this.cacheKeyByInstance.delete(instanceId);
      this.deps.port.stop(instanceId);
    }
    this.deps.onChange?.();
  }

  private run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.chain.then(task, task);
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
