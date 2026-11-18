import { describe, expect, it } from 'vitest';

import { createSessionWithProject } from '../../test-utils/studio-session-fixtures';
import { addAsset, removeAsset } from './asset-commands';
import { addAudioEffect, applyAudioChannelPreset } from './audio-effect-commands';
import { addAudioChannel } from './mixer-commands';
import { addOverlaySound, addOverlayTrigger, removeOverlaySound, updateOverlayBus } from './overlay-sound-commands';
import { createScene } from './scene-commands';
import { clearSelection, selectOverlaySound, setActiveScene } from './session-commands';

const audioAsset = {
  name: 'Sting',
  type: 'audio' as const,
  location: { kind: 'remoteUrl' as const, url: 'https://example.com/sting.mp3' },
  availability: 'available' as const,
};

describe('overlay sound commands', () => {
  it('stores a sound for an audio asset and refuses to delete that asset', () => {
    const { session, ctx } = createSessionWithProject(['p', 's', 'asset', 'sound', 'trigger']);
    const addedAsset = addAsset(session, audioAsset, ctx);
    expect(addedAsset.ok).toBe(true);
    if (!addedAsset.ok || !addedAsset.value.project) {
      return;
    }
    const assetId = addedAsset.value.project.assets[0]!.id;
    const added = addOverlaySound(addedAsset.value, { name: 'Sting', assetId }, ctx);
    expect(added.ok).toBe(true);
    if (!added.ok || !added.value.project) {
      return;
    }
    const soundId = added.value.project.audioMixer.overlay.sounds[0]!.id;
    const blocked = removeAsset(added.value, assetId, ctx);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error.kind).toBe('rule-violation');
    }

    const removed = removeOverlaySound(added.value, soundId, ctx);
    expect(removed.ok).toBe(true);
    if (!removed.ok) {
      return;
    }
    expect(removeAsset(removed.value, assetId, ctx).ok).toBe(true);
  });

  it('rejects a sound that does not point at an audio asset and a trigger for a missing sound', () => {
    const { session, ctx } = createSessionWithProject(['p', 's', 'asset', 'sound']);
    const picture = addAsset(
      session,
      {
        name: 'Picture',
        type: 'image',
        location: { kind: 'remoteUrl', url: 'https://example.com/picture.png' },
        availability: 'available',
      },
      ctx,
    );
    expect(picture.ok).toBe(true);
    if (!picture.ok || !picture.value.project) {
      return;
    }
    const assetId = picture.value.project.assets[0]!.id;
    expect(addOverlaySound(picture.value, { name: 'Sting', assetId }, ctx).ok).toBe(false);
    expect(addOverlayTrigger(picture.value, { soundId: 'missing', event: 'shown' }, ctx).ok).toBe(false);
  });

  it('adds an effect on the overlay bus and leaves that bus alone when a channel preset is applied', () => {
    const { session, ctx } = createSessionWithProject(['p', 's', 'ch', 'effect', 'preset-a', 'preset-b']);
    const channel = addAudioChannel(session, { name: 'Host' }, ctx);
    expect(channel.ok).toBe(true);
    if (!channel.ok || !channel.value.project) {
      return;
    }
    const channelId = channel.value.project.audioMixer.channels[0]!.id;
    const moved = updateOverlayBus(channel.value, { faderDb: -12 }, ctx);
    expect(moved.ok).toBe(true);
    if (!moved.ok) {
      return;
    }
    const effect = addAudioEffect(moved.value, { scope: 'overlay' }, 'high-pass', ctx);
    expect(effect.ok).toBe(true);
    if (!effect.ok || !effect.value.project) {
      return;
    }
    expect(effect.value.project.audioMixer.overlay.effects).toHaveLength(1);
    const applied = applyAudioChannelPreset(effect.value, channelId, 'system:clean-voice', ctx);
    expect(applied.ok).toBe(true);
    if (!applied.ok || !applied.value.project) {
      return;
    }
    expect(applied.value.project.audioMixer.overlay.faderDb).toBe(-12);
    expect(applied.value.project.audioMixer.overlay.effects).toHaveLength(1);
    expect(applied.value.project.audioMixer.channels[0]?.effects.length).toBeGreaterThan(0);
  });

  it('keeps a selected overlay sound across a scene change and drops it when the sound is gone', () => {
    const { session, ctx } = createSessionWithProject(['p', 's1', 's2', 'asset', 'sound']);
    const second = createScene(session, 'Scene 2', ctx);
    expect(second.ok).toBe(true);
    if (!second.ok || !second.value.project) {
      return;
    }
    const addedAsset = addAsset(second.value, audioAsset, ctx);
    expect(addedAsset.ok).toBe(true);
    if (!addedAsset.ok || !addedAsset.value.project) {
      return;
    }
    const assetId = addedAsset.value.project.assets[0]!.id;
    const added = addOverlaySound(addedAsset.value, { name: 'Sting', assetId }, ctx);
    expect(added.ok).toBe(true);
    if (!added.ok || !added.value.project) {
      return;
    }
    const soundId = added.value.project.audioMixer.overlay.sounds[0]!.id;
    const sceneId = added.value.project.scenes[1]!.id;
    const selected = selectOverlaySound(added.value, soundId);
    expect(selected.ok).toBe(true);
    if (!selected.ok) {
      return;
    }
    expect(selected.value.editor.selectedOverlaySoundId).toBe(soundId);
    expect(selected.value.editor.selectedElementIds).toEqual([]);

    const moved = setActiveScene(selected.value, sceneId);
    expect(moved.ok).toBe(true);
    if (!moved.ok) {
      return;
    }
    expect(moved.value.editor.selectedOverlaySoundId).toBe(soundId);
    expect(moved.value.editor.activeSceneId).toBe(sceneId);

    const cleared = clearSelection(moved.value);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) {
      return;
    }
    expect(cleared.value.editor.selectedOverlaySoundId).toBeNull();

    const again = selectOverlaySound(cleared.value, soundId);
    expect(again.ok).toBe(true);
    if (!again.ok) {
      return;
    }
    const removed = removeOverlaySound(again.value, soundId, ctx);
    expect(removed.ok).toBe(true);
    if (!removed.ok) {
      return;
    }
    expect(removed.value.editor.selectedOverlaySoundId).toBeNull();
    expect(selectOverlaySound(removed.value, soundId).ok).toBe(false);
  });
});
