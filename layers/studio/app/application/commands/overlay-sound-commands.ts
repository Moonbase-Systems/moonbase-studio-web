import type { AssetId, ElementId, OverlaySoundId, OverlayTriggerId, SceneId } from '../../models/ids.domain';
import type {
  OverlayBus,
  OverlayCueEvent,
  OverlayRestartPolicy,
  OverlaySound,
  OverlayTrigger,
} from '../../models/overlay-sound.domain';
import { createOverlaySound } from '../../models/overlay-sound.domain';
import type { Project } from '../../models/project.domain';
import { portErr } from '../../ports/result';
import { overlayBusChangesSchema, overlaySoundDraftSchema } from '../../schemas/overlay-sound.schema';
import { assertInitialized, withClonedProject } from '../command-utils';
import type { CommandContext } from '../context';
import type { StudioResult } from '../errors';
import type { StudioSession } from '../session';

export type OverlayBusChanges = Partial<
  Pick<OverlayBus, 'faderDb' | 'muted' | 'solo' | 'monitoring' | 'maxInstances' | 'sceneChangePolicy'>
>;

export type OverlaySoundDraft = {
  name: string;
  assetId: AssetId;
  volumeDb?: number;
  muted?: boolean;
  enabled?: boolean;
  loop?: boolean;
  startTimeSec?: number;
  endTimeSec?: number;
  playbackRate?: number;
  maxInstances?: number;
  cooldownMs?: number;
  restartPolicy?: OverlayRestartPolicy;
};

export type OverlaySoundChanges = Partial<Omit<OverlaySoundDraft, 'endTimeSec'>> & {
  endTimeSec?: number | null;
};

export type OverlayTriggerDraft = {
  soundId: OverlaySoundId;
  event: OverlayCueEvent;
  enabled?: boolean;
  sceneId?: SceneId;
  elementId?: ElementId;
};

export type OverlayTriggerChanges = {
  soundId?: OverlaySoundId;
  event?: OverlayCueEvent;
  enabled?: boolean;
  sceneId?: SceneId | null;
  elementId?: ElementId | null;
};

const ready = (session: StudioSession): StudioResult<Project> => {
  const initialized = assertInitialized(session);
  if (!initialized.ok) {
    return initialized;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }
  return { ok: true, value: session.project };
};

const audioAssetError = (project: Project, assetId: AssetId): StudioResult<never> | null => {
  const asset = project.assets.find((item) => item.id === assetId);
  if (!asset || asset.type !== 'audio') {
    return portErr({
      kind: 'invalid-argument',
      message: asset ? `Asset ${assetId} is not audio` : `Unknown asset ${assetId}`,
    });
  }
  return null;
};

const triggerTargetError = (
  project: Project,
  soundId: OverlaySoundId,
  sceneId?: SceneId,
  elementId?: ElementId,
): StudioResult<never> | null => {
  if (!project.audioMixer.overlay.sounds.some((sound) => sound.id === soundId)) {
    return portErr({ kind: 'overlay-sound-not-found', soundId });
  }
  if (sceneId && !project.scenes.some((scene) => scene.id === sceneId)) {
    return portErr({ kind: 'scene-not-found', sceneId });
  }
  if (!elementId) {
    return null;
  }
  const scenes = sceneId ? project.scenes.filter((scene) => scene.id === sceneId) : project.scenes;
  if (!scenes.some((scene) => scene.elements.some((element) => element.id === elementId))) {
    return portErr({ kind: 'invalid-argument', message: `Unknown element ${elementId}` });
  }
  return null;
};

const parseDraft = (draft: OverlaySoundDraft): StudioResult<OverlaySoundDraft> => {
  const parsed = overlaySoundDraftSchema.safeParse(draft);
  if (!parsed.success) {
    return portErr({
      kind: 'invalid-argument',
      message: parsed.error.issues[0]?.message ?? 'Invalid overlay sound',
    });
  }
  return { ok: true, value: parsed.data };
};

export const updateOverlayBus = (
  session: StudioSession,
  changes: OverlayBusChanges,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = ready(session);
  if (!project.ok) {
    return project;
  }
  const parsed = overlayBusChangesSchema.safeParse(changes);
  if (!parsed.success) {
    return portErr({
      kind: 'invalid-argument',
      message: parsed.error.issues[0]?.message ?? 'Invalid overlay bus',
    });
  }
  return withClonedProject(
    session,
    (next) => {
      next.audioMixer.overlay = { ...next.audioMixer.overlay, ...parsed.data };
    },
    ctx,
  );
};

export const addOverlaySound = (
  session: StudioSession,
  draft: OverlaySoundDraft,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = ready(session);
  if (!project.ok) {
    return project;
  }
  const parsed = parseDraft(draft);
  if (!parsed.ok) {
    return parsed;
  }
  const assetError = audioAssetError(project.value, parsed.value.assetId);
  if (assetError) {
    return assetError;
  }
  const sound = createOverlaySound({ ...parsed.value, id: ctx.generateId() });
  return withClonedProject(
    session,
    (next) => {
      next.audioMixer.overlay.sounds.push(sound);
    },
    ctx,
  );
};

export const updateOverlaySound = (
  session: StudioSession,
  soundId: OverlaySoundId,
  changes: OverlaySoundChanges,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = ready(session);
  if (!project.ok) {
    return project;
  }
  const current = project.value.audioMixer.overlay.sounds.find((sound) => sound.id === soundId);
  if (!current) {
    return portErr({ kind: 'overlay-sound-not-found', soundId });
  }
  const nextSound: OverlaySound = {
    ...current,
    ...changes,
    endTimeSec: changes.endTimeSec === null ? undefined : (changes.endTimeSec ?? current.endTimeSec),
  };
  const parsed = parseDraft(nextSound);
  if (!parsed.ok) {
    return parsed;
  }
  const assetError = audioAssetError(project.value, parsed.value.assetId);
  if (assetError) {
    return assetError;
  }
  return withClonedProject(
    session,
    (next) => {
      const sound = next.audioMixer.overlay.sounds.find((item) => item.id === soundId);
      if (sound) {
        Object.assign(sound, createOverlaySound({ ...parsed.value, id: soundId }));
      }
    },
    ctx,
  );
};

export const removeOverlaySound = (
  session: StudioSession,
  soundId: OverlaySoundId,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = ready(session);
  if (!project.ok) {
    return project;
  }
  if (!project.value.audioMixer.overlay.sounds.some((sound) => sound.id === soundId)) {
    return portErr({ kind: 'overlay-sound-not-found', soundId });
  }
  return withClonedProject(
    session,
    (next) => {
      next.audioMixer.overlay.sounds = next.audioMixer.overlay.sounds.filter((sound) => sound.id !== soundId);
      next.audioMixer.overlay.triggers = next.audioMixer.overlay.triggers.filter(
        (trigger) => trigger.soundId !== soundId,
      );
    },
    ctx,
  );
};

export const addOverlayTrigger = (
  session: StudioSession,
  draft: OverlayTriggerDraft,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = ready(session);
  if (!project.ok) {
    return project;
  }
  const targetError = triggerTargetError(project.value, draft.soundId, draft.sceneId, draft.elementId);
  if (targetError) {
    return targetError;
  }
  const trigger: OverlayTrigger = {
    id: ctx.generateId(),
    soundId: draft.soundId,
    event: draft.event,
    enabled: draft.enabled ?? true,
    ...(draft.sceneId ? { sceneId: draft.sceneId } : {}),
    ...(draft.elementId ? { elementId: draft.elementId } : {}),
  };
  return withClonedProject(
    session,
    (next) => {
      next.audioMixer.overlay.triggers.push(trigger);
    },
    ctx,
  );
};

export const updateOverlayTrigger = (
  session: StudioSession,
  triggerId: OverlayTriggerId,
  changes: OverlayTriggerChanges,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = ready(session);
  if (!project.ok) {
    return project;
  }
  const current = project.value.audioMixer.overlay.triggers.find((trigger) => trigger.id === triggerId);
  if (!current) {
    return portErr({ kind: 'overlay-trigger-not-found', triggerId });
  }
  const soundId = changes.soundId ?? current.soundId;
  const sceneId = changes.sceneId === null ? undefined : (changes.sceneId ?? current.sceneId);
  const elementId = changes.elementId === null ? undefined : (changes.elementId ?? current.elementId);
  const targetError = triggerTargetError(project.value, soundId, sceneId, elementId);
  if (targetError) {
    return targetError;
  }
  return withClonedProject(
    session,
    (next) => {
      const trigger = next.audioMixer.overlay.triggers.find((item) => item.id === triggerId);
      if (!trigger) {
        return;
      }
      trigger.soundId = soundId;
      trigger.event = changes.event ?? trigger.event;
      trigger.enabled = changes.enabled ?? trigger.enabled;
      if (sceneId) {
        trigger.sceneId = sceneId;
      } else {
        delete trigger.sceneId;
      }
      if (elementId) {
        trigger.elementId = elementId;
      } else {
        delete trigger.elementId;
      }
    },
    ctx,
  );
};

export const removeOverlayTrigger = (
  session: StudioSession,
  triggerId: OverlayTriggerId,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = ready(session);
  if (!project.ok) {
    return project;
  }
  if (!project.value.audioMixer.overlay.triggers.some((trigger) => trigger.id === triggerId)) {
    return portErr({ kind: 'overlay-trigger-not-found', triggerId });
  }
  return withClonedProject(
    session,
    (next) => {
      next.audioMixer.overlay.triggers = next.audioMixer.overlay.triggers.filter((trigger) => trigger.id !== triggerId);
    },
    ctx,
  );
};
