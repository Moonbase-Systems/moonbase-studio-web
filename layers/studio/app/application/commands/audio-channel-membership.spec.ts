import { describe, expect, it } from 'vitest';

import { createSessionWithProject } from '../../test-utils/studio-session-fixtures';
import { addLayer } from './layer-commands';
import { addAudioChannel, assignAudioSource, updateAudioChannel } from './mixer-commands';
import { createScene } from './scene-commands';
import { addSource } from './source-commands';

describe('audio channel membership', () => {
  it('reuses the channel when the same source is added to another scene', () => {
    const { session, ctx } = createSessionWithProject(['p', 's1', 'src', 'el1', 'ch', 's2', 'el2']);
    const sourced = addSource(session, { type: 'audio', name: 'Mic', deviceId: 'mic-1' }, ctx);
    expect(sourced.ok).toBe(true);
    if (!sourced.ok || !sourced.value.project) {
      return;
    }

    const sourceId = sourced.value.project.sources[0]!.id;
    const sceneId = sourced.value.project.scenes[0]!.id;
    const first = addLayer(sourced.value, sceneId, sourceId, undefined, ctx);
    expect(first.ok).toBe(true);
    if (!first.ok || !first.value.project) {
      return;
    }

    const channelId = first.value.project.audioMixer.channels[0]!.id;
    const secondScene = createScene(first.value, 'Scene 2', ctx);
    expect(secondScene.ok).toBe(true);
    if (!secondScene.ok || !secondScene.value.project) {
      return;
    }

    const otherSceneId = secondScene.value.project.scenes[1]!.id;
    const second = addLayer(secondScene.value, otherSceneId, sourceId, undefined, ctx);
    expect(second.ok).toBe(true);
    if (!second.ok || !second.value.project) {
      return;
    }

    expect(second.value.project.audioMixer.channels).toHaveLength(1);
    const layers = second.value.project.scenes.flatMap((scene) =>
      scene.elements.filter((element) => element.type === 'audioVisual'),
    );
    expect(layers).toHaveLength(2);
    expect(layers.every((element) => element.channelId === channelId)).toBe(true);
  });

  it('refuses to put one source on a second channel', () => {
    const { session, ctx } = createSessionWithProject(['p', 's1', 'src-a', 'ch-1', 'src-b', 'ch-2']);
    const firstSource = addSource(session, { type: 'audio', name: 'Mic', deviceId: 'mic-1' }, ctx);
    expect(firstSource.ok).toBe(true);
    if (!firstSource.ok || !firstSource.value.project) {
      return;
    }

    const sourceA = firstSource.value.project.sources[0]!.id;
    const channel = addAudioChannel(firstSource.value, { name: 'Host', sourceIds: [sourceA] }, ctx);
    expect(channel.ok).toBe(true);
    if (!channel.ok || !channel.value.project) {
      return;
    }

    const secondSource = addSource(channel.value, { type: 'audio', name: 'Guest', deviceId: 'mic-2' }, ctx);
    expect(secondSource.ok).toBe(true);
    if (!secondSource.ok || !secondSource.value.project) {
      return;
    }

    const sourceB = secondSource.value.project.sources[1]!.id;
    const hostId = secondSource.value.project.audioMixer.channels[0]!.id;
    const joined = assignAudioSource(secondSource.value, hostId, sourceB, ctx);
    expect(joined.ok).toBe(true);
    if (!joined.ok) {
      return;
    }

    const other = addAudioChannel(joined.value, { name: 'Other' }, ctx);
    expect(other.ok).toBe(true);
    if (!other.ok || !other.value.project) {
      return;
    }

    const otherId = other.value.project.audioMixer.channels[1]!.id;
    const stolen = assignAudioSource(other.value, otherId, sourceA, ctx);
    expect(stolen.ok).toBe(false);
    if (!stolen.ok) {
      expect(stolen.error.kind).toBe('invalid-argument');
    }
    expect(other.value.project.audioMixer.channels[0]?.sourceIds).toEqual([sourceA, sourceB]);
  });

  it('rejects a sync offset outside one second either way', () => {
    const { session, ctx } = createSessionWithProject(['p', 's1', 'src', 'ch']);
    const sourced = addSource(session, { type: 'audio', name: 'Mic', deviceId: 'mic-1' }, ctx);
    expect(sourced.ok).toBe(true);
    if (!sourced.ok) {
      return;
    }
    const sourceId = sourced.value.project!.sources[0]!.id;
    const added = addAudioChannel(sourced.value, { name: 'Host', sourceIds: [sourceId] }, ctx);
    expect(added.ok).toBe(true);
    if (!added.ok) {
      return;
    }
    const channelId = added.value.project!.audioMixer.channels[0]!.id;
    const updated = updateAudioChannel(added.value, channelId, { syncOffsetMs: 5000 }, ctx);
    expect(updated.ok).toBe(false);
  });
});
