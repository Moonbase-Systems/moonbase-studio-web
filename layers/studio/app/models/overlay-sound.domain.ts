import type { AudioEffect } from './audio-effect.domain';
import type { AssetId, ElementId, OverlaySoundId, OverlayTriggerId, SceneId } from './ids.domain';

/** Same three positions as a channel strip. The bus does not grow extra send flags. */
export type OverlayMonitoringMode = 'off' | 'monitor' | 'monitor-and-output';

export type OverlayRestartPolicy = 'allow' | 'restart' | 'ignore' | 'queue';

export type OverlaySceneChangePolicy = 'continue' | 'stop-scene-sounds' | 'stop-all-overlay-sounds';

export const OVERLAY_CUE_EVENTS = [
  'shown',
  'hidden',
  'animation-start',
  'animation-complete',
  'interaction',
  'custom',
  'follow',
  'subscription',
  'donation',
  'raid',
  'cheer',
  'chat',
] as const;

export type OverlayCueEvent = (typeof OVERLAY_CUE_EVENTS)[number];

/** Alerts a lab or a future source can publish. They are cue events, so a trigger can match them. */
export const OVERLAY_ALERT_TYPES = ['follow', 'subscription', 'donation', 'raid', 'cheer', 'chat', 'custom'] as const;

export type OverlayAlertType = (typeof OVERLAY_ALERT_TYPES)[number];

export const OVERLAY_FADER_DB_MIN = -60;
export const OVERLAY_FADER_DB_MAX = 12;
export const OVERLAY_VOLUME_DB_MIN = -24;
export const OVERLAY_VOLUME_DB_MAX = 12;
export const OVERLAY_PLAYBACK_RATE_MIN = 0.25;
export const OVERLAY_PLAYBACK_RATE_MAX = 4;
export const OVERLAY_COOLDOWN_MS_MAX = 60_000;
export const OVERLAY_BUS_INSTANCES_MIN = 1;
export const OVERLAY_BUS_INSTANCES_MAX = 64;
export const OVERLAY_BUS_INSTANCES_DEFAULT = 16;
export const OVERLAY_SOUND_INSTANCES_MIN = 1;
export const OVERLAY_SOUND_INSTANCES_MAX = 32;
export const OVERLAY_SOUND_INSTANCES_DEFAULT = 4;
export const OVERLAY_QUEUE_CAP = 8;

export type OverlaySound = {
  id: OverlaySoundId;
  name: string;
  assetId: AssetId;
  volumeDb: number;
  muted: boolean;
  enabled: boolean;
  loop: boolean;
  startTimeSec: number;
  endTimeSec?: number;
  playbackRate: number;
  maxInstances: number;
  cooldownMs: number;
  restartPolicy: OverlayRestartPolicy;
};

export type OverlayTrigger = {
  id: OverlayTriggerId;
  soundId: OverlaySoundId;
  event: OverlayCueEvent;
  enabled: boolean;
  sceneId?: SceneId;
  elementId?: ElementId;
};

/**
 * Project-level overlay bus. Instances, buffers, and queues stay in the session.
 * The fader is in dB, unity at 0, like a channel fader.
 */
export type OverlayBus = {
  faderDb: number;
  muted: boolean;
  solo: boolean;
  monitoring: OverlayMonitoringMode;
  effects: AudioEffect[];
  maxInstances: number;
  sceneChangePolicy: OverlaySceneChangePolicy;
  sounds: OverlaySound[];
  triggers: OverlayTrigger[];
};

export const createDefaultOverlayBus = (): OverlayBus => ({
  faderDb: 0,
  muted: false,
  solo: false,
  monitoring: 'off',
  effects: [],
  maxInstances: OVERLAY_BUS_INSTANCES_DEFAULT,
  sceneChangePolicy: 'continue',
  sounds: [],
  triggers: [],
});

export const createOverlaySound = (
  input: Pick<OverlaySound, 'id' | 'name' | 'assetId'> & Partial<Omit<OverlaySound, 'id' | 'name' | 'assetId'>>,
): OverlaySound => ({
  id: input.id,
  name: input.name,
  assetId: input.assetId,
  volumeDb: input.volumeDb ?? 0,
  muted: input.muted ?? false,
  enabled: input.enabled ?? true,
  loop: input.loop ?? false,
  startTimeSec: input.startTimeSec ?? 0,
  endTimeSec: input.endTimeSec,
  playbackRate: input.playbackRate ?? 1,
  maxInstances: input.maxInstances ?? OVERLAY_SOUND_INSTANCES_DEFAULT,
  cooldownMs: input.cooldownMs ?? 0,
  restartPolicy: input.restartPolicy ?? 'allow',
});
