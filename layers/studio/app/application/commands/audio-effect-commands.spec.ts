import { describe, expect, it } from 'vitest';

import { createSessionWithProject } from '../../test-utils/studio-session-fixtures';
import {
  addAudioEffect,
  applyAudioChannelPreset,
  applyAudioEffectPreset,
  copyAudioEffect,
  removeAudioEffect,
  reorderAudioEffect,
  resetAudioEffectCommand,
  saveAudioChannelPreset,
  saveAudioEffectPreset,
  setAudioEffectEnabled,
  updateAudioEffectParameters,
} from './audio-effect-commands';
import { addAudioChannel } from './mixer-commands';
import { addSource } from './source-commands';

const channelSession = (ids: string[]) => {
  const { session, ctx } = createSessionWithProject(ids);
  const sourced = addSource(session, { type: 'audio', name: 'Mic', deviceId: 'mic-1' }, ctx);
  if (!sourced.ok) {
    throw new Error('source');
  }
  const sourceId = sourced.value.project!.sources[0]!.id;
  const added = addAudioChannel(sourced.value, { name: 'Host', sourceIds: [sourceId] }, ctx);
  if (!added.ok) {
    throw new Error('channel');
  }
  const channelId = added.value.project!.audioMixer.channels[0]!.id;
  return { session: added.value, ctx, channelId, sourceId };
};

describe('audio effect commands', () => {
  it('adds, bypasses, reorders, copies, and resets an effect', () => {
    const { session, ctx, channelId } = channelSession(['p', 's', 'src', 'ch', 'eq', 'copy', 'master']);
    const location = { scope: 'channel' as const, channelId };
    const added = addAudioEffect(session, location, 'eq-band', ctx);
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    const effectId = added.value.project!.audioMixer.channels[0]!.effects[0]!.id;
    const bypassed = setAudioEffectEnabled(added.value, location, effectId, false, ctx);
    expect(bypassed.ok && bypassed.value.project?.audioMixer.channels[0]?.effects[0]?.enabled).toBe(false);
    if (!bypassed.ok) {
      return;
    }

    const comp = addAudioEffect(bypassed.value, location, 'compressor', ctx);
    expect(comp.ok).toBe(true);
    if (!comp.ok) {
      return;
    }
    const moved = reorderAudioEffect(comp.value, location, effectId, 1, ctx);
    expect(moved.ok && moved.value.project?.audioMixer.channels[0]?.effects.map((effect) => effect.id)).toEqual([
      'copy',
      'eq',
    ]);
    if (!moved.ok) {
      return;
    }

    const copied = copyAudioEffect(moved.value, location, 'eq', { scope: 'master' }, ctx);
    expect(copied.ok).toBe(true);
    if (!copied.ok) {
      return;
    }
    const masterEffect = copied.value.project?.audioMixer.master.effects[0];
    expect(masterEffect?.type).toBe('eq-band');
    expect(masterEffect?.id).not.toBe('eq');

    const reset = resetAudioEffectCommand(copied.value, location, 'eq', ctx);
    expect(
      reset.ok && reset.value.project?.audioMixer.channels[0]?.effects.find((effect) => effect.id === 'eq'),
    ).toMatchObject({
      id: 'eq',
      parameters: { gainDb: 0, frequencyHz: 1000 },
    });
  });

  it('rejects parameters outside the effect range', () => {
    const { session, ctx, channelId } = channelSession(['p', 's', 'src', 'ch', 'eq']);
    const location = { scope: 'channel' as const, channelId };
    const added = addAudioEffect(session, location, 'eq-band', ctx);
    if (!added.ok) {
      throw new Error('effect');
    }
    const updated = updateAudioEffectParameters(
      added.value,
      location,
      'eq',
      { filter: 'peaking', frequencyHz: 1000, gainDb: 40, q: 1 },
      ctx,
    );
    expect(updated.ok).toBe(false);
  });

  it('applies a system channel preset onto the strip and leaves routing alone', () => {
    const { session, ctx, channelId, sourceId } = channelSession(['p', 's', 'src', 'ch', 'e1', 'e2']);
    const marked = {
      ...session,
      project: session.project && {
        ...session.project,
        audioMixer: {
          ...session.project.audioMixer,
          channels: session.project.audioMixer.channels.map((channel) =>
            channel.id === channelId
              ? { ...channel, solo: true, monitoring: 'monitor' as const, sourceIds: [sourceId] }
              : channel,
          ),
        },
      },
    };
    const applied = applyAudioChannelPreset(marked, channelId, 'system:clean-voice', ctx);
    expect(applied.ok).toBe(true);
    if (!applied.ok || !applied.value.project) {
      return;
    }
    const channel = applied.value.project.audioMixer.channels[0]!;
    expect(channel.solo).toBe(true);
    expect(channel.monitoring).toBe('monitor');
    expect(channel.sourceIds).toEqual([sourceId]);
    expect(channel.effects.map((effect) => effect.type)).toEqual(['high-pass', 'compressor']);
    expect(applied.value.project.audioMixer.presets).toEqual([]);
  });

  it('saves a channel preset without routing fields and rejects an effect preset of the wrong type', () => {
    const { session, ctx, channelId } = channelSession(['p', 's', 'src', 'ch', 'eq', 'comp', 'preset', 'fx']);
    const location = { scope: 'channel' as const, channelId };
    const eq = addAudioEffect(session, location, 'eq-band', ctx);
    if (!eq.ok) {
      throw new Error('eq');
    }
    const comp = addAudioEffect(eq.value, location, 'compressor', ctx);
    if (!comp.ok) {
      throw new Error('comp');
    }
    const saved = saveAudioEffectPreset(comp.value, location, 'eq', 'Air', ctx);
    expect(saved.ok).toBe(true);
    if (!saved.ok || !saved.value.project) {
      return;
    }
    const preset = saved.value.project.audioMixer.presets[0];
    expect(preset?.kind).toBe('effect');
    if (preset?.kind !== 'effect') {
      return;
    }
    expect(preset.effect).not.toHaveProperty('id');
    const mismatched = applyAudioEffectPreset(saved.value, location, 'comp', preset.id, ctx);
    expect(mismatched.ok).toBe(false);

    const channelPreset = saveAudioChannelPreset(saved.value, channelId, 'Mine', ctx);
    expect(channelPreset.ok).toBe(true);
    if (!channelPreset.ok || !channelPreset.value.project) {
      return;
    }
    const stored = channelPreset.value.project.audioMixer.presets.find((item) => item.kind === 'channel');
    expect(stored && stored.kind === 'channel' && stored).toMatchObject({ trimDb: 0, muted: false });
    expect(stored && stored.kind === 'channel' && 'solo' in stored).toBe(false);
    expect(stored && stored.kind === 'channel' && 'sourceIds' in stored).toBe(false);
  });

  it('rejects a stored preset whose format version is not supported', () => {
    const { session, ctx, channelId } = channelSession(['p', 's', 'src', 'ch']);
    session.project!.audioMixer.presets.push({
      id: 'bad',
      formatVersion: 2,
      kind: 'channel',
      name: 'Bad',
      trimDb: 0,
      faderDb: 0,
      pan: 0,
      muted: false,
      effects: [],
    } as never);
    const applied = applyAudioChannelPreset(session, channelId, 'bad', ctx);
    expect(applied.ok).toBe(false);
    if (!applied.ok) {
      expect(applied.error.kind).toBe('invalid-argument');
    }
  });

  it('removes an effect and leaves the channel', () => {
    const { session, ctx, channelId } = channelSession(['p', 's', 'src', 'ch', 'eq']);
    const location = { scope: 'channel' as const, channelId };
    const added = addAudioEffect(session, location, 'high-pass', ctx);
    if (!added.ok) {
      throw new Error('effect');
    }
    const removed = removeAudioEffect(added.value, location, 'eq', ctx);
    expect(removed.ok && removed.value.project?.audioMixer.channels[0]?.effects).toEqual([]);
    expect(removed.ok && removed.value.project?.audioMixer.channels).toHaveLength(1);
  });
});
