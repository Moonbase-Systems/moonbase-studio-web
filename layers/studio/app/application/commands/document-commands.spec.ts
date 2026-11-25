import { describe, expect, it } from 'vitest';

import { createSessionWithProject } from '../../test-utils/studio-session-fixtures';
import { addAsset, removeAsset, updateAsset } from './asset-commands';
import { addAudioChannel, removeAudioChannel, updateAudioChannel, updateAudioMaster } from './mixer-commands';
import { applyOutputPreset, updateOutputProfile, updateProject } from './project-commands';
import { setSceneDefaultTransition } from './scene-commands';
import { addSource } from './source-commands';
import { addTransition, removeTransition, updateTransition } from './transition-commands';

describe('project document commands', () => {
  it('updates project name, type, and output profile', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1']);
    const renamed = updateProject(session, { name: 'Renamed', type: 'podcast' }, ctx);

    expect(renamed.ok).toBe(true);
    if (!renamed.ok) {
      return;
    }
    const updated = updateOutputProfile(renamed.value, { frameRate: 60 }, ctx);
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.project?.name).toBe('Renamed');
      expect(updated.value.project?.type).toBe('podcast');
      expect(updated.value.project?.settings.outputProfile.frameRate).toBe(60);
      expect(updated.value.project?.settings.outputProfile.width).toBe(1920);
      expect(updated.value.project?.settings.outputProfile.id).toBe(session.project?.settings.outputProfile.id);
      expect(updated.value.isDirty).toBe(true);
    }
  });

  it('keeps the profile id and preset origin when the frame is edited', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1']);
    const id = session.project?.settings.outputProfile.id;
    const applied = applyOutputPreset(session, 'shorts-1080', ctx);
    expect(applied.ok).toBe(true);
    if (!applied.ok) {
      return;
    }
    expect(applied.value.project?.settings.outputProfile).toMatchObject({
      id,
      name: 'Vertical 1080p',
      width: 1080,
      height: 1920,
      frameRate: 30,
      originPresetId: 'shorts-1080',
    });

    const edited = updateOutputProfile(applied.value, { width: 2560, frameRate: 29.97 }, ctx);
    expect(edited.ok).toBe(true);
    if (!edited.ok) {
      return;
    }
    expect(edited.value.project?.settings.outputProfile).toMatchObject({
      id,
      name: 'Vertical 1080p',
      width: 2560,
      height: 1920,
      frameRate: 29.97,
      originPresetId: 'shorts-1080',
    });
  });

  it('rejects an empty project name without changing the session', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1']);
    const before = structuredClone(session);
    const updated = updateProject(session, { name: '   ' }, ctx);
    expect(updated.ok).toBe(false);
    expect(session).toEqual(before);
  });

  it('adds, updates, and removes an unused asset', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1', 'asset-1']);
    const added = addAsset(
      session,
      {
        name: 'clip.mp4',
        type: 'video',
        location: { kind: 'storageKey', key: 'media/clip.mp4' },
        availability: 'pending',
      },
      ctx,
    );
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }

    const assetId = added.value.project!.assets[0]!.id;
    const renamed = updateAsset(added.value, assetId, { availability: 'available', name: 'Clip' }, ctx);
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) {
      return;
    }
    expect(renamed.value.project?.assets[0]?.availability).toBe('available');

    const removed = removeAsset(renamed.value, assetId, ctx);
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.value.project?.assets).toHaveLength(0);
    }
  });

  it('refuses to remove an asset that a source still uses', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1', 'asset-1', 'src-1']);
    const added = addAsset(
      session,
      {
        name: 'hero.png',
        type: 'image',
        location: { kind: 'remoteUrl', url: 'https://example.com/hero.png' },
        availability: 'available',
      },
      ctx,
    );
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }

    const assetId = added.value.project!.assets[0]!.id;
    const sourced = addSource(added.value, { type: 'image', name: 'Hero', assetId }, ctx);
    expect(sourced.ok).toBe(true);
    if (!sourced.ok) {
      return;
    }

    const removed = removeAsset(sourced.value, assetId, ctx);
    expect(removed.ok).toBe(false);
    if (!removed.ok) {
      expect(removed.error.kind).toBe('rule-violation');
    }
  });

  it('adds, updates, and removes an audio channel bound to a source', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1', 'src-1', 'ch-1']);
    const sourced = addSource(session, { type: 'audio', name: 'Mic', deviceId: 'mic-1' }, ctx);
    expect(sourced.ok).toBe(true);
    if (!sourced.ok) {
      return;
    }

    const sourceId = sourced.value.project!.sources[0]!.id;
    const master = updateAudioMaster(sourced.value, { volume: 0.5, muted: true }, ctx);
    expect(master.ok).toBe(true);
    if (!master.ok) {
      return;
    }
    expect(master.value.project?.audioMixer.master).toEqual({ volume: 0.5, muted: true, effects: [] });

    const added = addAudioChannel(master.value, { name: 'Host', sourceIds: [sourceId] }, ctx);
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }

    const channelId = added.value.project!.audioMixer.channels[0]!.id;
    const updated = updateAudioChannel(added.value, channelId, { pan: -0.25 }, ctx);
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.value.project?.audioMixer.channels[0]?.pan).toBe(-0.25);

    const removed = removeAudioChannel(updated.value, channelId, ctx);
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.value.project?.audioMixer.channels).toHaveLength(0);
    }
  });

  it('rejects an audio channel that points at a missing source', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1']);
    const added = addAudioChannel(session, { name: 'Host', sourceIds: ['missing-source'] }, ctx);
    expect(added.ok).toBe(false);
    if (!added.ok) {
      expect(added.error.kind).toBe('source-not-found');
    }
  });

  it('adds, updates, and removes an unused transition', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1', 'tr-1']);
    const added = addTransition(session, { type: 'fade', durationMs: 400, easing: 'linear', settings: {} }, ctx);
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }

    const transitionId = added.value.project!.transitions[0]!.id;
    const updated = updateTransition(
      added.value,
      transitionId,
      { durationMs: 800, settings: { curve: 'ease-in' } },
      ctx,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.value.project?.transitions[0]?.durationMs).toBe(800);

    const removed = removeTransition(updated.value, transitionId, ctx);
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.value.project?.transitions).toHaveLength(0);
    }
  });

  it('refuses to remove a transition assigned as a scene default', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1', 'tr-1']);
    const added = addTransition(session, { type: 'cut', durationMs: 0, easing: 'linear', settings: {} }, ctx);
    expect(added.ok).toBe(true);
    if (!added.ok || !added.value.project) {
      return;
    }

    const transitionId = added.value.project.transitions[0]!.id;
    const sceneId = added.value.project.scenes[0]!.id;
    const assigned = setSceneDefaultTransition(added.value, sceneId, transitionId, ctx);

    expect(assigned.ok).toBe(true);
    if (!assigned.ok) {
      return;
    }

    const removed = removeTransition(assigned.value, transitionId, ctx);
    expect(removed.ok).toBe(false);
    if (!removed.ok) {
      expect(removed.error).toMatchObject({ kind: 'rule-violation', rule: 'transition-in-use' });
    }
  });
});
