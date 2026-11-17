import type { AudioChannel } from '../../models/audio.domain';
import {
  type AudioEffect,
  type AudioEffectType,
  createAudioEffect,
  duplicateAudioEffect,
  effectTemplateFrom,
  instantiateEffectTemplate,
  isAudioEffectType,
  moveAudioEffect,
  resetAudioEffect,
} from '../../models/audio-effect.domain';
import {
  type AudioChannelPreset,
  type AudioEffectPreset,
  type AudioUserPreset,
  findSystemChannelPreset,
  presetRejection,
} from '../../models/audio-preset.domain';
import type { ChannelId, EffectId } from '../../models/ids.domain';
import type { Project } from '../../models/project.domain';
import { portErr } from '../../ports/result';
import {
  audioEffectNameSchema,
  audioUserPresetSchema,
  parseAudioEffectParameters,
} from '../../schemas/audio-effect.schema';
import { assertInitialized, withClonedProject } from '../command-utils';
import type { CommandContext } from '../context';
import type { StudioResult } from '../errors';
import type { StudioSession } from '../session';

export type AudioEffectLocation = { scope: 'channel'; channelId: ChannelId } | { scope: 'master' };

const readChain = (project: Project, location: AudioEffectLocation): StudioResult<AudioEffect[]> => {
  if (location.scope === 'master') {
    return { ok: true, value: project.audioMixer.master.effects };
  }
  const channel = project.audioMixer.channels.find((item) => item.id === location.channelId);
  if (!channel) {
    return portErr({ kind: 'channel-not-found', channelId: location.channelId });
  }
  return { ok: true, value: channel.effects };
};

const writeChain = (project: Project, location: AudioEffectLocation, effects: AudioEffect[]): void => {
  if (location.scope === 'master') {
    project.audioMixer.master.effects = effects;
    return;
  }
  const channel = project.audioMixer.channels.find((item) => item.id === location.channelId);
  if (channel) {
    channel.effects = effects;
  }
};

const findEffect = (effects: readonly AudioEffect[], effectId: EffectId): AudioEffect | undefined =>
  effects.find((effect) => effect.id === effectId);

const readyProject = (session: StudioSession): StudioResult<Project> => {
  const ready = assertInitialized(session);
  if (!ready.ok) {
    return ready;
  }
  if (!session.project) {
    return portErr({ kind: 'no-project' });
  }
  return { ok: true, value: session.project };
};

export const addAudioEffect = (
  session: StudioSession,
  location: AudioEffectLocation,
  type: AudioEffectType,
  ctx: CommandContext,
  name?: string,
): StudioResult<StudioSession> => {
  const project = readyProject(session);
  if (!project.ok) {
    return project;
  }
  if (!isAudioEffectType(type)) {
    return portErr({ kind: 'invalid-argument', message: 'Unknown audio effect type' });
  }
  if (name !== undefined && !audioEffectNameSchema.safeParse(name).success) {
    return portErr({ kind: 'invalid-argument', message: 'Invalid effect name' });
  }
  const chain = readChain(project.value, location);
  if (!chain.ok) {
    return chain;
  }
  const effect = createAudioEffect({ id: ctx.generateId(), type, name });
  if (chain.value.some((item) => item.id === effect.id)) {
    return portErr({ kind: 'invalid-argument', message: 'Effect id already exists' });
  }
  return withClonedProject(
    session,
    (next) => {
      const current = readChain(next, location);
      if (current.ok) {
        writeChain(next, location, [...current.value, effect]);
      }
    },
    ctx,
  );
};

export const removeAudioEffect = (
  session: StudioSession,
  location: AudioEffectLocation,
  effectId: EffectId,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = readyProject(session);
  if (!project.ok) {
    return project;
  }
  const chain = readChain(project.value, location);
  if (!chain.ok) {
    return chain;
  }
  if (!findEffect(chain.value, effectId)) {
    return portErr({ kind: 'effect-not-found', effectId });
  }
  return withClonedProject(
    session,
    (next) => {
      const current = readChain(next, location);
      if (current.ok) {
        writeChain(
          next,
          location,
          current.value.filter((effect) => effect.id !== effectId),
        );
      }
    },
    ctx,
  );
};

export const setAudioEffectEnabled = (
  session: StudioSession,
  location: AudioEffectLocation,
  effectId: EffectId,
  enabled: boolean,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = readyProject(session);
  if (!project.ok) {
    return project;
  }
  if (typeof enabled !== 'boolean') {
    return portErr({ kind: 'invalid-argument', message: 'enabled must be boolean' });
  }
  const chain = readChain(project.value, location);
  if (!chain.ok) {
    return chain;
  }
  if (!findEffect(chain.value, effectId)) {
    return portErr({ kind: 'effect-not-found', effectId });
  }
  return withClonedProject(
    session,
    (next) => {
      const current = readChain(next, location);
      if (!current.ok) {
        return;
      }
      writeChain(
        next,
        location,
        current.value.map((effect) => (effect.id === effectId ? { ...effect, enabled } : effect)),
      );
    },
    ctx,
  );
};

export const updateAudioEffectParameters = (
  session: StudioSession,
  location: AudioEffectLocation,
  effectId: EffectId,
  parameters: unknown,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = readyProject(session);
  if (!project.ok) {
    return project;
  }
  const chain = readChain(project.value, location);
  if (!chain.ok) {
    return chain;
  }
  const effect = findEffect(chain.value, effectId);
  if (!effect) {
    return portErr({ kind: 'effect-not-found', effectId });
  }
  const parsed = parseAudioEffectParameters(effect.type, parameters);
  if (!parsed.success) {
    return portErr({ kind: 'invalid-argument', message: 'Effect parameters are out of range' });
  }
  const nextParameters = parsed.data;
  return withClonedProject(
    session,
    (next) => {
      const current = readChain(next, location);
      if (!current.ok) {
        return;
      }
      writeChain(
        next,
        location,
        current.value.map((item) =>
          item.id === effectId ? ({ ...item, parameters: nextParameters } as AudioEffect) : item,
        ),
      );
    },
    ctx,
  );
};

export const renameAudioEffect = (
  session: StudioSession,
  location: AudioEffectLocation,
  effectId: EffectId,
  name: string,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = readyProject(session);
  if (!project.ok) {
    return project;
  }
  const parsedName = audioEffectNameSchema.safeParse(name);
  if (!parsedName.success) {
    return portErr({ kind: 'invalid-argument', message: 'Invalid effect name' });
  }
  const chain = readChain(project.value, location);
  if (!chain.ok) {
    return chain;
  }
  if (!findEffect(chain.value, effectId)) {
    return portErr({ kind: 'effect-not-found', effectId });
  }
  return withClonedProject(
    session,
    (next) => {
      const current = readChain(next, location);
      if (!current.ok) {
        return;
      }
      writeChain(
        next,
        location,
        current.value.map((effect) => (effect.id === effectId ? { ...effect, name: parsedName.data } : effect)),
      );
    },
    ctx,
  );
};

export const reorderAudioEffect = (
  session: StudioSession,
  location: AudioEffectLocation,
  effectId: EffectId,
  toIndex: number,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = readyProject(session);
  if (!project.ok) {
    return project;
  }
  const chain = readChain(project.value, location);
  if (!chain.ok) {
    return chain;
  }
  const moved = moveAudioEffect(chain.value, effectId, toIndex);
  if (!moved) {
    return findEffect(chain.value, effectId)
      ? portErr({ kind: 'invalid-argument', message: 'Effect index is out of range' })
      : portErr({ kind: 'effect-not-found', effectId });
  }
  return withClonedProject(
    session,
    (next) => {
      writeChain(next, location, moved);
    },
    ctx,
  );
};

export const copyAudioEffect = (
  session: StudioSession,
  from: AudioEffectLocation,
  effectId: EffectId,
  to: AudioEffectLocation,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = readyProject(session);
  if (!project.ok) {
    return project;
  }
  const source = readChain(project.value, from);
  if (!source.ok) {
    return source;
  }
  const effect = findEffect(source.value, effectId);
  if (!effect) {
    return portErr({ kind: 'effect-not-found', effectId });
  }
  const destination = readChain(project.value, to);
  if (!destination.ok) {
    return destination;
  }
  const copy = duplicateAudioEffect(effect, ctx.generateId());
  return withClonedProject(
    session,
    (next) => {
      const current = readChain(next, to);
      if (current.ok) {
        writeChain(next, to, [...current.value, copy]);
      }
    },
    ctx,
  );
};

export const resetAudioEffectCommand = (
  session: StudioSession,
  location: AudioEffectLocation,
  effectId: EffectId,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = readyProject(session);
  if (!project.ok) {
    return project;
  }
  const chain = readChain(project.value, location);
  if (!chain.ok) {
    return chain;
  }
  const effect = findEffect(chain.value, effectId);
  if (!effect) {
    return portErr({ kind: 'effect-not-found', effectId });
  }
  const reset = resetAudioEffect(effect);
  return withClonedProject(
    session,
    (next) => {
      const current = readChain(next, location);
      if (!current.ok) {
        return;
      }
      writeChain(
        next,
        location,
        current.value.map((item) => (item.id === effectId ? reset : item)),
      );
    },
    ctx,
  );
};

const parseStoredPreset = (preset: unknown): StudioResult<AudioUserPreset> => {
  const parsed = audioUserPresetSchema.safeParse(preset);
  if (!parsed.success) {
    return portErr({ kind: 'invalid-argument', message: 'Preset version or shape is not supported' });
  }
  return { ok: true, value: parsed.data };
};

export const saveAudioChannelPreset = (
  session: StudioSession,
  channelId: ChannelId,
  name: string,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = readyProject(session);
  if (!project.ok) {
    return project;
  }
  const parsedName = audioEffectNameSchema.safeParse(name);
  if (!parsedName.success) {
    return portErr({ kind: 'invalid-argument', message: 'Invalid preset name' });
  }
  const channel = project.value.audioMixer.channels.find((item) => item.id === channelId);
  if (!channel) {
    return portErr({ kind: 'channel-not-found', channelId });
  }
  const preset: AudioChannelPreset = {
    id: ctx.generateId(),
    formatVersion: 1,
    kind: 'channel',
    name: parsedName.data,
    trimDb: channel.trimDb,
    faderDb: channel.faderDb,
    pan: channel.pan,
    muted: channel.muted,
    effects: channel.effects.map((effect) => effectTemplateFrom(effect)),
  };
  const stored = parseStoredPreset(preset);
  if (!stored.ok) {
    return stored;
  }
  return withClonedProject(
    session,
    (next) => {
      next.audioMixer.presets = [...next.audioMixer.presets, stored.value];
    },
    ctx,
  );
};

export const saveAudioEffectPreset = (
  session: StudioSession,
  location: AudioEffectLocation,
  effectId: EffectId,
  name: string,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = readyProject(session);
  if (!project.ok) {
    return project;
  }
  const parsedName = audioEffectNameSchema.safeParse(name);
  if (!parsedName.success) {
    return portErr({ kind: 'invalid-argument', message: 'Invalid preset name' });
  }
  const chain = readChain(project.value, location);
  if (!chain.ok) {
    return chain;
  }
  const effect = findEffect(chain.value, effectId);
  if (!effect) {
    return portErr({ kind: 'effect-not-found', effectId });
  }
  const preset: AudioEffectPreset = {
    id: ctx.generateId(),
    formatVersion: 1,
    kind: 'effect',
    name: parsedName.data,
    effect: effectTemplateFrom(effect),
  };
  const stored = parseStoredPreset(preset);
  if (!stored.ok) {
    return stored;
  }
  return withClonedProject(
    session,
    (next) => {
      next.audioMixer.presets = [...next.audioMixer.presets, stored.value];
    },
    ctx,
  );
};

export const removeAudioPreset = (
  session: StudioSession,
  presetId: string,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = readyProject(session);
  if (!project.ok) {
    return project;
  }
  if (presetId.startsWith('system:')) {
    return portErr({ kind: 'invalid-argument', message: 'System presets stay in the application' });
  }
  if (!project.value.audioMixer.presets.some((preset) => preset.id === presetId)) {
    return portErr({ kind: 'preset-not-found', presetId });
  }
  return withClonedProject(
    session,
    (next) => {
      next.audioMixer.presets = next.audioMixer.presets.filter((preset) => preset.id !== presetId);
    },
    ctx,
  );
};

const resolvePreset = (project: Project, presetId: string): AudioUserPreset | AudioChannelPreset | undefined =>
  findSystemChannelPreset(presetId) ?? project.audioMixer.presets.find((preset) => preset.id === presetId);

export const applyAudioChannelPreset = (
  session: StudioSession,
  channelId: ChannelId,
  presetId: string,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = readyProject(session);
  if (!project.ok) {
    return project;
  }
  const channel = project.value.audioMixer.channels.find((item) => item.id === channelId);
  if (!channel) {
    return portErr({ kind: 'channel-not-found', channelId });
  }
  const preset = resolvePreset(project.value, presetId);
  if (!preset) {
    return portErr({ kind: 'preset-not-found', presetId });
  }
  const rejection = presetRejection(preset, 'channel');
  if (rejection || preset.kind !== 'channel') {
    return portErr({ kind: 'invalid-argument', message: 'Preset version or kind is not supported' });
  }
  const effects = preset.effects.map((template) => instantiateEffectTemplate(template, ctx.generateId()));
  return withClonedProject(
    session,
    (next) => {
      const target = next.audioMixer.channels.find((item) => item.id === channelId);
      if (!target) {
        return;
      }
      const updated: AudioChannel = {
        ...target,
        trimDb: preset.trimDb,
        faderDb: preset.faderDb,
        pan: preset.pan,
        muted: preset.muted,
        effects,
      };
      const index = next.audioMixer.channels.findIndex((item) => item.id === channelId);
      next.audioMixer.channels[index] = updated;
    },
    ctx,
  );
};

export const applyAudioEffectPreset = (
  session: StudioSession,
  location: AudioEffectLocation,
  effectId: EffectId,
  presetId: string,
  ctx: CommandContext,
): StudioResult<StudioSession> => {
  const project = readyProject(session);
  if (!project.ok) {
    return project;
  }
  const preset = project.value.audioMixer.presets.find((item) => item.id === presetId);
  if (!preset) {
    return portErr({ kind: 'preset-not-found', presetId });
  }
  const rejection = presetRejection(preset, 'effect');
  if (rejection || preset.kind !== 'effect') {
    return portErr({ kind: 'invalid-argument', message: 'Preset version or kind is not supported' });
  }
  const chain = readChain(project.value, location);
  if (!chain.ok) {
    return chain;
  }
  const effect = findEffect(chain.value, effectId);
  if (!effect) {
    return portErr({ kind: 'effect-not-found', effectId });
  }
  if (preset.effect.type !== effect.type) {
    return portErr({ kind: 'invalid-argument', message: 'Preset type does not match the effect' });
  }
  const replacement = instantiateEffectTemplate(preset.effect, effect.id);
  return withClonedProject(
    session,
    (next) => {
      const current = readChain(next, location);
      if (!current.ok) {
        return;
      }
      writeChain(
        next,
        location,
        current.value.map((item) => (item.id === effectId ? replacement : item)),
      );
    },
    ctx,
  );
};
