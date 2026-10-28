import { describe, expect, it } from 'vitest';

import { createSessionWithProject } from '../../test-utils/studio-session-fixtures';
import { addLayer, duplicateLayer, moveLayer, removeLayer, updateLayer } from './layer-commands';
import { createScene } from './scene-commands';
import { selectLayer } from './session-commands';
import { addSource } from './source-commands';

const sessionWithSource = () => {
  const fixture = createSessionWithProject(['p1', 's1', 's2', 'l1', 'l2', 'l3', 'src1', 'fx1', 'fx2']);
  let session = fixture.session;
  const added = addSource(fixture.session, { type: 'text', name: 'Img', content: 'Hello' }, fixture.ctx);
  if (added.ok) {
    session = added.value;
  }
  return { ...fixture, session };
};

describe('layer commands', () => {
  it('adds a layer with an existing source and rejects missing sources', () => {
    const { session, ctx } = sessionWithSource();
    const sceneId = session.project!.scenes[0]!.id;
    const sourceId = session.project!.sources[0]!.id;

    const before = structuredClone(session);
    const missing = addLayer(session, sceneId, 'missing', undefined, ctx);
    expect(missing.ok).toBe(false);
    expect(session).toEqual(before);

    const added = addLayer(session, sceneId, sourceId, { name: 'Hero' }, ctx);
    expect(added.ok).toBe(true);
    if (added.ok) {
      expect(added.value.project?.scenes[0]?.elements).toHaveLength(1);
      expect(added.value.project?.scenes[0]?.elements[0]?.name).toBe('Hero');
      expect(added.value.editor.selectedElementIds[0]).toBe(added.value.project?.scenes[0]?.elements[0]?.id);
      expect(added.value.isDirty).toBe(true);
    }
  });

  it('duplicates layers without sharing mutable effect objects', () => {
    const { session, ctx } = sessionWithSource();
    const sceneId = session.project!.scenes[0]!.id;
    const sourceId = session.project!.sources[0]!.id;
    let current = session;
    const added = addLayer(current, sceneId, sourceId, undefined, ctx);
    if (added.ok) {
      current = added.value;
    }
    const layerId = current.project!.scenes[0]!.elements[0]!.id;
    const updated = updateLayer(
      current,
      sceneId,
      layerId,
      {
        effects: [
          {
            id: 'fx1',
            name: 'Blur',
            type: 'blur',
            enabled: true,
            parameters: { radius: 2 },
          },
        ],
      },
      ctx,
    );
    if (updated.ok) {
      current = updated.value;
    }

    const duplicated = duplicateLayer(current, sceneId, layerId, ctx);
    expect(duplicated.ok).toBe(true);
    if (duplicated.ok) {
      const elements = duplicated.value.project!.scenes[0]!.elements;
      expect(elements).toHaveLength(2);
      expect(elements[0]?.type).not.toBe('overlay');
      expect(elements[1]?.type).not.toBe('overlay');
      const first = elements[0];
      const second = elements[1];
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      if (first!.type !== 'overlay' && second!.type !== 'overlay') {
        expect(second!.sourceId).toBe(first!.sourceId);
      }
      expect(elements[1]?.effects).not.toBe(elements[0]?.effects);
      expect(elements[1]?.effects[0]?.id).not.toBe(elements[0]?.effects[0]?.id);
    }
  });

  it('validates update fields and locked layers', () => {
    const { session, ctx } = sessionWithSource();
    const sceneId = session.project!.scenes[0]!.id;
    const sourceId = session.project!.sources[0]!.id;
    let current = session;
    const added = addLayer(current, sceneId, sourceId, undefined, ctx);
    if (added.ok) {
      current = added.value;
    }
    const layerId = current.project!.scenes[0]!.elements[0]!.id;

    const badField = updateLayer(current, sceneId, layerId, { sourceId: 'x' } as never, ctx);
    expect(badField.ok).toBe(false);

    const badOpacity = updateLayer(current, sceneId, layerId, { appearance: { opacity: 2 } }, ctx);
    expect(badOpacity.ok).toBe(false);

    const locked = updateLayer(current, sceneId, layerId, { locked: true }, ctx);
    if (locked.ok) {
      current = locked.value;
    }

    const blocked = updateLayer(current, sceneId, layerId, { name: 'New' }, ctx);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error.kind).toBe('rule-violation');
    }
  });

  it('moves layers deterministically within a scene', () => {
    const { session, ctx } = sessionWithSource();
    const sceneId = session.project!.scenes[0]!.id;
    const sourceId = session.project!.sources[0]!.id;
    let current = session;

    for (const name of ['A', 'B', 'C']) {
      const added = addLayer(current, sceneId, sourceId, { name }, ctx);
      if (added.ok) {
        current = added.value;
      }
    }

    const ids = current.project!.scenes[0]!.elements.map((element) => element.id);
    const moved = moveLayer(current, sceneId, ids[0]!, 2, ctx);
    expect(moved.ok).toBe(true);
    if (moved.ok) {
      const reordered = moved.value.project!.scenes[0]!.elements.map((element) => element.name);
      expect(reordered).toEqual(['B', 'C', 'A']);
    }

    const otherScene = createScene(current, 'Other', ctx);
    if (otherScene.ok) {
      current = otherScene.value;
    }
    const otherSceneId = current.project!.scenes.find((scene) => scene.name === 'Other')!.id;
    const otherBefore = current.project!.scenes.find((scene) => scene.id === otherSceneId)!.elements.length;
    const topId = current.project!.scenes[0]!.elements[2]!.id;
    const noop = moveLayer(current, sceneId, topId, 2, ctx);
    expect(noop.ok).toBe(true);
    if (noop.ok) {
      expect(noop.value.isDirty).toBe(current.isDirty);
      expect(current.project!.scenes.find((scene) => scene.id === otherSceneId)!.elements).toHaveLength(otherBefore);
    }
  });

  it('clears selection when removing the selected layer', () => {
    const { session, ctx } = sessionWithSource();
    const sceneId = session.project!.scenes[0]!.id;
    const sourceId = session.project!.sources[0]!.id;
    let current = session;
    const added = addLayer(current, sceneId, sourceId, undefined, ctx);
    if (added.ok) {
      current = added.value;
    }
    const layerId = current.project!.scenes[0]!.elements[0]!.id;
    const selected = selectLayer(current, layerId);
    if (selected.ok) {
      current = selected.value;
    }

    const removed = removeLayer(current, sceneId, layerId, ctx);
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.value.editor.selectedElementIds).toEqual([]);
    }
  });
});
